
import { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calculator } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface TRIMPCalculatorProps {
  onTRIMPCalculated: (value: number) => void;
}

export const TRIMPCalculator = ({ onTRIMPCalculated }: TRIMPCalculatorProps) => {
  const [duration, setDuration] = useState<string>('');
  const [restingHR, setRestingHR] = useState<string>('');
  const [maxHR, setMaxHR] = useState<string>('');
  const [avgHR, setAvgHR] = useState<string>('');
  const [lthr, setLthr] = useState<string>('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [calculatedTrimp, setCalculatedTrimp] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  const calculateTrimp = () => {
    // Parse inputs
    const durationMinutes = parseFloat(duration);
    const restingHeartRate = parseFloat(restingHR);
    const maxHeartRate = parseFloat(maxHR);
    const averageHeartRate = parseFloat(avgHR);
    
    // Validate inputs
    if (
      isNaN(durationMinutes) || 
      isNaN(restingHeartRate) || 
      isNaN(maxHeartRate) || 
      isNaN(averageHeartRate)
    ) {
      return;
    }

    // Calculate Heart Rate Reserve (HRR)
    const hRR = (averageHeartRate - restingHeartRate) / (maxHeartRate - restingHeartRate);
    
    // Factor depending on gender
    const factor = gender === 'male' ? 1.92 : 1.67;
    
    // Calculate TRIMP using the formula
    // TRIMP = Duration × HRR × 0.64 × e^(Factor × HRR)
    const eFactor = Math.exp(factor * hRR);
    const trimp = Math.round(durationMinutes * hRR * 0.64 * eFactor);
    
    setCalculatedTrimp(trimp);
  };

  useEffect(() => {
    calculateTrimp();
  }, [duration, restingHR, maxHR, avgHR, gender]);

  const handleApply = () => {
    if (calculatedTrimp !== null) {
      onTRIMPCalculated(calculatedTrimp);
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="absolute right-2 top-8 flex gap-1"
          title="Calculate TRIMP"
        >
          <Calculator className="h-4 w-4" />
          <span className="hidden sm:inline">Calculate TRIMP</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>TRIMP Calculator</DialogTitle>
          <DialogDescription>
            Calculate your Training Impulse (TRIMP) value based on your workout data.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="duration">Duration (minutes)</Label>
            <Input 
              id="duration" 
              type="number" 
              value={duration} 
              onChange={(e) => setDuration(e.target.value)}
              placeholder="e.g. 260"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="restingHR">Resting Heart Rate (bpm)</Label>
              <Input 
                id="restingHR" 
                type="number" 
                value={restingHR} 
                onChange={(e) => setRestingHR(e.target.value)}
                placeholder="e.g. 42"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxHR">Max Heart Rate (bpm)</Label>
              <Input 
                id="maxHR" 
                type="number" 
                value={maxHR} 
                onChange={(e) => setMaxHR(e.target.value)}
                placeholder="e.g. 185"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="avgHR">Average Heart Rate (bpm)</Label>
              <Input 
                id="avgHR" 
                type="number" 
                value={avgHR} 
                onChange={(e) => setAvgHR(e.target.value)}
                placeholder="e.g. 124"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lthr">LTHR (optional)</Label>
              <Input 
                id="lthr" 
                type="number" 
                value={lthr} 
                onChange={(e) => setLthr(e.target.value)}
                placeholder="e.g. 164"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Gender</Label>
            <RadioGroup value={gender} onValueChange={(value) => setGender(value as 'male' | 'female')} className="flex space-x-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="male" id="male" />
                <Label htmlFor="male">Male (1.92)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="female" id="female" />
                <Label htmlFor="female">Female (1.67)</Label>
              </div>
            </RadioGroup>
          </div>
          
          <div className="space-y-2 bg-muted/30 p-4 rounded-md">
            <div className="text-center">
              <Label>Calculated TRIMP</Label>
              <div className="text-2xl font-bold mt-2">
                {calculatedTrimp !== null ? calculatedTrimp : '-'}
              </div>
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" onClick={handleApply} disabled={calculatedTrimp === null}>
            Apply Value
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
