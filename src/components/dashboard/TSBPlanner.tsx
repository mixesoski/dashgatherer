
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, PlaneDeparture } from "lucide-react";
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

export function TSBPlanner({ latestTSB, latestATL, latestCTL }: TSBPlannerProps) {
  const [eventDate, setEventDate] = useState<Date | undefined>(addDays(new Date(), 14));
  const [targetTSB, setTargetTSB] = useState<string>(latestTSB ? Math.round(latestTSB + 20).toString() : "10");
  const [planningResults, setPlanningResults] = useState<Array<{ date: Date; trimp: number; projectedTSB: number }>>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const isMobile = useIsMobile();

  // Calculate the plan when inputs change
  const calculatePlan = () => {
    if (!eventDate || !latestATL || !latestCTL) {
      toast.error("Missing data to calculate plan");
      return;
    }
    
    setIsCalculating(true);
    
    try {
      // Clone the latest metrics to work with
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
      
      // Start with a baseline TRIMP that would maintain current fitness
      const maintenanceTrimp = currentCTL;
      
      // Calculate required average TRIMP to reach target TSB
      // TSB = CTL - ATL, so we need to manipulate both values
      const targetATL = currentCTL - target;
      
      // Calculate the required change in ATL
      const atlChange = targetATL - currentATL;
      
      // Calculate baseline TRIMP that would maintain both ATL and CTL
      const dailyAvgTrimp = maintenanceTrimp + (atlChange / (1 - Math.pow(0.87, daysUntilEvent))) * 7;
      
      const results: Array<{ date: Date; trimp: number; projectedTSB: number }> = [];
      
      // Initialize with today's values
      let projectedATL = currentATL;
      let projectedCTL = currentCTL;
      let projectedTSB = projectedCTL - projectedATL;
      
      // Generate the plan for each day
      for (let i = 0; i < daysUntilEvent; i++) {
        const date = addDays(today, i);
        
        // Calculate TRIMP for this day - can be adjusted based on desired distribution
        // Here we're using a simple approach to gradually increase/decrease
        const dayFactor = Math.sin((i / daysUntilEvent) * Math.PI);
        const adjustedTrimp = Math.max(0, Math.round(dailyAvgTrimp * (0.8 + dayFactor * 0.4)));
        
        // Project metrics for this day
        projectedATL = projectedATL + (adjustedTrimp - projectedATL) / 7;
        projectedCTL = projectedCTL + (adjustedTrimp - projectedCTL) / 42;
        projectedTSB = projectedCTL - projectedATL;
        
        results.push({
          date,
          trimp: adjustedTrimp,
          projectedTSB: projectedTSB
        });
      }
      
      setPlanningResults(results);
    } catch (error) {
      console.error("Error calculating plan:", error);
      toast.error("Failed to calculate training plan");
    } finally {
      setIsCalculating(false);
    }
  };

  // Reset the calculation if inputs change
  useEffect(() => {
    setPlanningResults([]);
  }, [eventDate, targetTSB]);

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
          <PlaneDeparture className="h-5 w-5" />
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
            <p className="text-sm text-muted-foreground mb-4">
              Follow this plan to reach a TSB of {parseFloat(targetTSB).toFixed(1)} by {format(eventDate!, "PPP")}
            </p>
            
            <div className={isMobile ? "overflow-x-auto" : ""}>
              <Table className={isMobile ? "w-[500px]" : ""}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Recommended TRIMP</TableHead>
                    <TableHead className="text-right">Projected TSB</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {planningResults.map((day, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        {format(day.date, "EEE, MMM d")}
                      </TableCell>
                      <TableCell className="text-right">{day.trimp}</TableCell>
                      <TableCell className="text-right">{day.projectedTSB.toFixed(1)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="border-t pt-4 text-xs text-muted-foreground">
        <p>
          The TSB Planner calculates recommended daily training load (TRIMP) to reach your 
          target form (TSB) by your event date. Adjust your actual training based on how you feel.
        </p>
      </CardFooter>
    </Card>
  );
}
