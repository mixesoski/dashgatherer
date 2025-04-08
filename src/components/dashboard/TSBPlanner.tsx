
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plane, Edit2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, addDays, isBefore } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

interface TSBPlannerProps {
  latestTSB: number | null;
  latestATL: number | null;
  latestCTL: number | null;
}

interface PlanDay {
  date: Date;
  trimp: number;
  projectedTSB: number;
  isCustom: boolean;
}

export function TSBPlanner({ latestTSB, latestATL, latestCTL }: TSBPlannerProps) {
  const [eventDate, setEventDate] = useState<Date | undefined>(addDays(new Date(), 14));
  const [targetTSB, setTargetTSB] = useState<string>(latestTSB ? Math.round(latestTSB + 20).toString() : "10");
  const [planningResults, setPlanningResults] = useState<PlanDay[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [customTrimpValue, setCustomTrimpValue] = useState<string>("");
  const isMobile = useIsMobile();

  const calculatePlan = () => {
    if (!eventDate || !latestATL || !latestCTL) {
      toast.error("Missing data to calculate plan");
      return;
    }
    
    setIsCalculating(true);
    
    try {
      let currentATL = latestATL;
      let currentCTL = latestCTL;
      
      const target = parseFloat(targetTSB);
      const today = new Date();
      const daysUntilEvent = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
      
      if (daysUntilEvent <= 0) {
        toast.error("Event date must be in the future");
        setIsCalculating(false);
        return;
      }
      
      const maintenanceTrimp = currentCTL;
      
      const targetATL = currentCTL - target;
      
      const atlChange = targetATL - currentATL;
      
      const dailyAvgTrimp = maintenanceTrimp + (atlChange / (1 - Math.pow(0.87, daysUntilEvent))) * 7;
      
      const results: PlanDay[] = [];
      
      let projectedATL = currentATL;
      let projectedCTL = currentCTL;
      let projectedTSB = projectedCTL - projectedATL;
      
      const customDays = new Map<string, number>();
      planningResults.forEach(day => {
        if (day.isCustom) {
          const dateStr = format(day.date, 'yyyy-MM-dd');
          customDays.set(dateStr, day.trimp);
        }
      });
      
      // Calculate plan for each day leading up to the event
      for (let i = 0; i < daysUntilEvent; i++) {
        const date = addDays(today, i);
        const dateStr = format(date, 'yyyy-MM-dd');
        
        const hasCustomValue = customDays.has(dateStr);
        
        let adjustedTrimp;
        if (hasCustomValue) {
          adjustedTrimp = customDays.get(dateStr)!;
        } else {
          const dayFactor = Math.sin((i / daysUntilEvent) * Math.PI);
          adjustedTrimp = Math.max(0, Math.round(dailyAvgTrimp * (0.8 + dayFactor * 0.4)));
        }
        
        projectedATL = projectedATL + (adjustedTrimp - projectedATL) / 7;
        projectedCTL = projectedCTL + (adjustedTrimp - projectedCTL) / 42;
        projectedTSB = projectedCTL - projectedATL;
        
        results.push({
          date,
          trimp: adjustedTrimp,
          projectedTSB: projectedTSB,
          isCustom: hasCustomValue
        });
      }
      
      if (customDays.size > 0) {
        recalculateRemainingDays(results, targetTSB, eventDate);
      }
      
      // Calculate the final TSB on the event day itself (with a TRIMP of 0)
      // We need to explicitly calculate this to avoid showing the previous day's TSB
      let eventDayATL = results.length > 0 ? 
        results[results.length - 1].projectedATL || 
        (results[results.length - 1].trimp - results[results.length - 1].projectedTSB) : 
        currentATL;
      
      let eventDayCTL = results.length > 0 ? 
        results[results.length - 1].projectedCTL || 
        (results[results.length - 1].trimp + results[results.length - 1].projectedTSB) : 
        currentCTL;
      
      // On event day, we typically assume no training load (TRIMP=0)
      const eventDayTrimp = 0; 
      
      // Update for event day (ATL decays faster than CTL)
      eventDayATL = eventDayATL + (eventDayTrimp - eventDayATL) / 7;
      eventDayCTL = eventDayCTL + (eventDayTrimp - eventDayCTL) / 42;
      
      // Final TSB on event day
      const eventDayTSB = eventDayCTL - eventDayATL;
      
      setPlanningResults(results);
      
      // Store the event day TSB for display in the UI
      setEventDayFinalTSB(eventDayTSB);
    } catch (error) {
      console.error("Error calculating plan:", error);
      toast.error("Failed to calculate training plan");
    } finally {
      setIsCalculating(false);
    }
  };

  // Add state to store the event day TSB
  const [eventDayFinalTSB, setEventDayFinalTSB] = useState<number | null>(null);

  const recalculateRemainingDays = (plan: PlanDay[], targetTSB: string, eventDate: Date) => {
    try {
      const adjustableDays = plan.filter(day => !day.isCustom);
      
      if (adjustableDays.length === 0) {
        return;
      }
      
      const finalDay = plan[plan.length - 1];
      const currentFinalTSB = finalDay.projectedTSB;
      const targetTSBValue = parseFloat(targetTSB);
      
      const tsbGap = targetTSBValue - currentFinalTSB;
      
      if (Math.abs(tsbGap) < 0.5) {
        return;
      }
      
      const totalDays = adjustableDays.length;
      let totalAdjustment = 0;
      
      for (let i = 0; i < plan.length; i++) {
        const day = plan[i];
        
        if (!day.isCustom) {
          const daysFromStart = i;
          const daysToEvent = plan.length - i - 1;
          
          const weight = 0.5 + (daysToEvent / totalDays) * 0.5;
          
          const adjustment = -tsbGap * weight * 0.5;
          
          const newTrimp = Math.max(0, Math.round(day.trimp + adjustment));
          
          plan[i].trimp = newTrimp;
          
          totalAdjustment += adjustment;
        }
      }
      
      let atl = latestATL!;
      let ctl = latestCTL!;
      
      for (let i = 0; i < plan.length; i++) {
        const day = plan[i];
        
        atl = atl + (day.trimp - atl) / 7;
        ctl = ctl + (day.trimp - ctl) / 42;
        
        plan[i].projectedTSB = ctl - atl;
        // Store ATL and CTL in the plan for later use in event day calculation
        plan[i].projectedATL = atl;
        plan[i].projectedCTL = ctl;
      }
      
      // Calculate event day TSB with zero TRIMP on event day
      if (plan.length > 0) {
        const lastDay = plan[plan.length - 1];
        let eventDayATL = lastDay.projectedATL;
        let eventDayCTL = lastDay.projectedCTL;
        
        // On event day (zero TRIMP)
        eventDayATL = eventDayATL + (0 - eventDayATL) / 7;
        eventDayCTL = eventDayCTL + (0 - eventDayCTL) / 42;
        
        // Update the event day TSB
        setEventDayFinalTSB(eventDayCTL - eventDayATL);
      }
    } catch (error) {
      console.error("Error recalculating plan:", error);
    }
  };

  const handleCustomTrimp = (index: number) => {
    const trimpValue = parseInt(customTrimpValue);
    
    if (isNaN(trimpValue) || trimpValue < 0) {
      toast.error("Please enter a valid TRIMP value (positive number)");
      return;
    }
    
    const updatedResults = [...planningResults];
    updatedResults[index].trimp = trimpValue;
    updatedResults[index].isCustom = true;
    
    setPlanningResults(updatedResults);
    
    setEditingDay(null);
    setCustomTrimpValue("");
    
    setTimeout(() => {
      calculatePlan();
    }, 100);
    
    toast.success("Custom training value set");
  };

  useEffect(() => {
    setPlanningResults([]);
    setEventDayFinalTSB(null);
  }, [eventDate, targetTSB]);

  // Add missing type for extended PlanDay
  interface ExtendedPlanDay extends PlanDay {
    projectedATL?: number;
    projectedCTL?: number;
  }

  if (!latestATL || !latestCTL) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>TSB Planner</CardTitle>
          <CardDescription>
            Plan your training to reach a specific form for your event
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-muted-foreground">
              Not enough training data available to create a plan.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Add training data to use the TSB planner.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plane className="h-5 w-5" />
          TSB Planner
        </CardTitle>
        <CardDescription>
          Plan your training to reach a specific form for your event
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 mb-6">
          <div className="space-y-2">
            <Label htmlFor="event-date">Event Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="event-date"
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !eventDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {eventDate ? format(eventDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-50" align="start">
                <Calendar
                  mode="single"
                  selected={eventDate}
                  onSelect={setEventDate}
                  disabled={(date) => isBefore(date, new Date())}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="target-tsb">Target TSB</Label>
            <div className="flex items-center gap-2">
              <Input 
                id="target-tsb"
                type="number"
                value={targetTSB}
                onChange={(e) => setTargetTSB(e.target.value)}
                placeholder="e.g. 10"
                className="flex-1"
              />
              <Button 
                onClick={calculatePlan}
                disabled={isCalculating || !eventDate}
                className="flex-shrink-0"
              >
                {isCalculating ? "Calculating..." : "Calculate Plan"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Current TSB: {latestTSB?.toFixed(1) || "N/A"}
            </p>
          </div>
        </div>
        
        {planningResults.length > 0 && (
          <div className="mt-4">
            <h3 className="text-lg font-semibold mb-2">Training Plan</h3>
            
            <div className={isMobile ? "overflow-x-auto" : ""}>
              <Table className={isMobile ? "w-[500px]" : ""}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>TRIMP</TableHead>
                    <TableHead className="text-right">Projected TSB</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {planningResults.map((day, index) => (
                    <TableRow key={index} className={day.isCustom ? "bg-primary/5" : ""}>
                      <TableCell className="font-medium">
                        {format(day.date, "EEE, MMM d")}
                      </TableCell>
                      <TableCell>
                        {editingDay === index ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={customTrimpValue}
                              onChange={(e) => setCustomTrimpValue(e.target.value)}
                              className="w-20 h-8"
                              autoFocus
                              min="0"
                            />
                            <Button 
                              size="sm" 
                              onClick={() => handleCustomTrimp(index)}
                              className="h-8 px-2"
                            >
                              Set
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => setEditingDay(null)}
                              className="h-8 px-2"
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <span className={day.isCustom ? "font-medium text-primary" : ""}>
                            {day.trimp}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{day.projectedTSB.toFixed(1)}</TableCell>
                      <TableCell>
                        {editingDay !== index && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              setEditingDay(index);
                              setCustomTrimpValue(day.trimp.toString());
                            }}
                          >
                            <Edit2 className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  
                  <TableRow className="border-t-2 border-primary bg-primary/10 font-medium">
                    <TableCell className="font-bold">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4 text-primary" />
                        <span className="text-primary">EVENT DAY</span>
                      </div>
                      <span className="text-xs block text-muted-foreground">
                        {eventDate && format(eventDate, "EEEE, MMMM do")}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-normal text-muted-foreground">
                        Target
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div>
                        <span className={cn(
                          "font-bold text-lg",
                          eventDayFinalTSB !== null && 
                          (Math.abs(eventDayFinalTSB - parseFloat(targetTSB)) < 2 
                            ? "text-green-600" 
                            : eventDayFinalTSB < parseFloat(targetTSB)
                              ? "text-orange-500"
                              : "text-red-500")
                        )}>
                          {eventDayFinalTSB !== null ? eventDayFinalTSB.toFixed(1) : "0.0"}
                        </span>
                        <span className="text-xs block text-muted-foreground">
                          Target: {parseFloat(targetTSB).toFixed(1)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="border-t pt-4 text-xs text-muted-foreground">
        <div className="space-y-2 w-full">
          <p>
            The TSB Planner calculates recommended daily training load (TRIMP) to reach your 
            target form (TSB) by your event date.
          </p>
          <p className="text-xs">
            <span className="font-medium">Pro tip:</span> Click the edit button to customize TRIMP values for specific days. The planner will automatically recalculate the remaining days to help you reach your target TSB.
          </p>
        </div>
      </CardFooter>
    </Card>
  );
}
