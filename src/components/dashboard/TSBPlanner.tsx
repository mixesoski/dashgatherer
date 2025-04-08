import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plane, Edit2, Lock } from "lucide-react";
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
  projectedATL?: number;
  projectedCTL?: number;
}

export function TSBPlanner({ latestTSB, latestATL, latestCTL }: TSBPlannerProps) {
  const [eventDate, setEventDate] = useState<Date | undefined>(addDays(new Date(), 14));
  const [targetTSB, setTargetTSB] = useState<string>(latestTSB ? Math.round(latestTSB + 20).toString() : "10");
  const [planningResults, setPlanningResults] = useState<PlanDay[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [customTrimpValue, setCustomTrimpValue] = useState<string>("");
  const [eventDayFinalTSB, setEventDayFinalTSB] = useState<number | null>(null);
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
      
      // Base maintenance TRIMP (maintains current fitness)
      const maintenanceTrimp = currentCTL;
      
      // Calculate target ATL for the event day
      const targetATL = currentCTL - target;
      
      // Calculate change in ATL needed to reach target TSB
      const atlChange = targetATL - currentATL;
      
      // Calculate daily average TRIMP needed
      const dailyAvgTrimp = maintenanceTrimp + (atlChange / (1 - Math.pow(0.87, daysUntilEvent))) * 7;
      
      const results: PlanDay[] = [];
      
      let projectedATL = currentATL;
      let projectedCTL = currentCTL;
      let projectedTSB = projectedCTL - projectedATL;
      
      // Preserve any custom TRIMP values from previous calculations
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
          // Create a sinusoidal pattern for training load
          const dayFactor = Math.sin((i / daysUntilEvent) * Math.PI);
          adjustedTrimp = Math.max(0, Math.round(dailyAvgTrimp * (0.8 + dayFactor * 0.4)));
        }
        
        // Store current TSB (before applying today's training)
        const todayTSB = projectedCTL - projectedATL;
        
        // Update ATL and CTL based on today's training
        projectedATL = projectedATL + (adjustedTrimp - projectedATL) / 7;
        projectedCTL = projectedCTL + (adjustedTrimp - projectedCTL) / 42;
        
        // The TSB we store for today is actually yesterday's CTL - yesterday's ATL
        // This reflects that today's training affects tomorrow's TSB
        results.push({
          date,
          trimp: adjustedTrimp,
          projectedTSB: todayTSB, // Use the TSB from before today's training
          projectedATL: projectedATL,
          projectedCTL: projectedCTL,
          isCustom: hasCustomValue
        });
      }
      
      // If there are custom days, recalculate the remaining days to hit the target
      if (customDays.size > 0) {
        recalculateRemainingDays(results, target, eventDate);
      } else {
        // Make final adjustments to hit target TSB even without custom days
        adjustPlanToHitTargetTSB(results, target);
      }
      
      // Calculate the final TSB on the event day itself (with a TRIMP of 0)
      if (results.length > 0) {
        const lastDay = results[results.length - 1];
        let eventDayATL = lastDay.projectedATL || currentATL;
        let eventDayCTL = lastDay.projectedCTL || currentCTL;
        
        // Calculate the TSB for the event day (which is based on the values AFTER the last training day)
        // This is correct because TSB on event day = the CTL and ATL after the last training day
        const eventDayTSB = eventDayCTL - eventDayATL;
        
        // Store the event day TSB for display in the UI
        setEventDayFinalTSB(eventDayTSB);
      }
      
      setPlanningResults(results);
      
    } catch (error) {
      console.error("Error calculating plan:", error);
      toast.error("Failed to calculate training plan");
    } finally {
      setIsCalculating(false);
    }
  };

  // New function to adjust the plan to hit target TSB precisely
  const adjustPlanToHitTargetTSB = (plan: PlanDay[], targetTSB: number) => {
    if (plan.length === 0) return;
    
    // Calculate what the event day TSB would be with the current plan
    const lastDay = plan[plan.length - 1];
    let eventDayATL = lastDay.projectedATL || 0;
    let eventDayCTL = lastDay.projectedCTL || 0;
    
    // Event day TSB is calculated using the final ATL and CTL values after the last training day
    const projectedEventTSB = eventDayCTL - eventDayATL;
    
    // If we're already close enough to target, don't adjust
    if (Math.abs(projectedEventTSB - targetTSB) < 0.5) return;
    
    // Determine how much to adjust each day's TRIMP to hit the target
    const tsbDifference = targetTSB - projectedEventTSB;
    const adjustmentFactor = tsbDifference / plan.length;
    
    // Work backwards to calculate required adjustments
    for (let i = plan.length - 1; i >= 0; i--) {
      // More aggressive adjustments for days closer to the event
      const dayWeight = 0.5 + ((plan.length - i) / plan.length) * 0.5;
      const trimpAdjustment = adjustmentFactor * dayWeight * -10; // Negative because increasing TRIMP decreases TSB
      
      let newTrimp = plan[i].trimp;
      
      // Don't adjust custom days
      if (!plan[i].isCustom) {
        newTrimp = Math.max(0, Math.round(newTrimp + trimpAdjustment));
        plan[i].trimp = newTrimp;
      }
    }
    
    // Recalculate ATL, CTL, and TSB for all days after adjustments
    let currentATL = plan[0].projectedATL || 0;
    let currentCTL = plan[0].projectedCTL || 0;
    
    if (plan.length > 0) {
      currentATL = currentATL || latestATL || 0;
      currentCTL = currentCTL || latestCTL || 0;
      
      for (let i = 0; i < plan.length; i++) {
        const day = plan[i];
        
        // Store the current TSB before applying today's training
        const todayTSB = currentCTL - currentATL;
        
        // Update based on today's training
        currentATL = currentATL + (day.trimp - currentATL) / 7;
        currentCTL = currentCTL + (day.trimp - currentCTL) / 42;
        
        plan[i].projectedATL = currentATL;
        plan[i].projectedCTL = currentCTL;
        plan[i].projectedTSB = todayTSB; // The TSB we show is before today's training effect
      }
      
      // Calculate event day values (which is the TSB resulting from the last day's training)
      if (plan.length > 0) {
        const lastDay = plan[plan.length - 1];
        let eventDayATL = lastDay.projectedATL || 0;
        let eventDayCTL = lastDay.projectedCTL || 0;
        
        // The event day TSB is the CTL minus ATL after the final training day
        setEventDayFinalTSB(eventDayCTL - eventDayATL);
      }
    }
  };

  const recalculateRemainingDays = (plan: PlanDay[], targetTSB: number | string, eventDate: Date) => {
    try {
      const adjustableDays = plan.filter(day => !day.isCustom);
      
      if (adjustableDays.length === 0) {
        return;
      }
      
      const target = typeof targetTSB === 'string' ? parseFloat(targetTSB) : targetTSB;
      
      // Calculate what the event day TSB would be with the current plan
      if (plan.length > 0) {
        const lastDay = plan[plan.length - 1];
        let eventDayATL = lastDay.projectedATL || 0;
        let eventDayCTL = lastDay.projectedCTL || 0;
        
        // Event day TSB is calculated from the final ATL and CTL values
        const projectedEventTSB = eventDayCTL - eventDayATL;
        const tsbGap = target - projectedEventTSB;
        
        // If we're already close enough to target, don't recalculate
        if (Math.abs(tsbGap) < 0.5) {
          setEventDayFinalTSB(projectedEventTSB);
          return;
        }
        
        // Adjust non-custom days to compensate for the TSB gap
        const totalDays = adjustableDays.length;
        
        for (let i = 0; i < plan.length; i++) {
          const day = plan[i];
          
          if (!day.isCustom) {
            const daysToEvent = plan.length - i - 1;
            
            // Weight adjustments more heavily for days closer to the event
            const weight = 0.5 + (daysToEvent / totalDays) * 0.5;
            
            // Negative adjustment because increasing TRIMP decreases TSB
            const adjustment = -tsbGap * weight * 0.7;
            
            const newTrimp = Math.max(0, Math.round(day.trimp + adjustment));
            plan[i].trimp = newTrimp;
          }
        }
        
        // Recalculate ATL, CTL, and TSB for all days
        let atl = latestATL || 0;
        let ctl = latestCTL || 0;
        
        for (let i = 0; i < plan.length; i++) {
          const day = plan[i];
          
          // Calculate TSB before applying today's training
          const todayTSB = ctl - atl;
          
          // Update ATL and CTL based on today's training
          atl = atl + (day.trimp - atl) / 7;
          ctl = ctl + (day.trimp - ctl) / 42;
          
          plan[i].projectedTSB = todayTSB;
          plan[i].projectedATL = atl;
          plan[i].projectedCTL = ctl;
        }
        
        // Calculate final event day TSB
        const lastDayUpdated = plan[plan.length - 1];
        let finalEventDayATL = lastDayUpdated.projectedATL || 0;
        let finalEventDayCTL = lastDayUpdated.projectedCTL || 0;
        
        setEventDayFinalTSB(finalEventDayCTL - finalEventDayATL);
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

  if (!latestATL || !latestCTL) {
    return (
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 z-10 bg-black/50 flex flex-col items-center justify-center text-white">
          <Lock className="h-12 w-12 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Coming Soon</h2>
          <p className="text-center px-4">
            TSB Planner is currently in development. Stay tuned for this exciting feature!
          </p>
        </div>
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
          <div className="flex flex-col items-center justify-center py-8 text-center opacity-30">
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
    <Card className="relative w-full">
      <div className="absolute inset-0 z-10 bg-black/50 flex flex-col items-center justify-center text-white pointer-events-none">
        <Lock className="h-12 w-12 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Coming Soon</h2>
        <p className="text-center px-4">
          TSB Planner is currently in development. Stay tuned for this exciting feature!
        </p>
      </div>
      
      {/* Existing content with reduced opacity */}
      <CardHeader className="opacity-30">
        <CardTitle className="flex items-center gap-2">
          <Plane className="h-5 w-5" />
          TSB Planner
        </CardTitle>
        <CardDescription>
          Plan your training to reach a specific form for your event
        </CardDescription>
      </CardHeader>
      
      <CardContent className="opacity-30 pointer-events-none">
        {/* Keep existing content, but make it non-interactive */}
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
                  disabled
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
