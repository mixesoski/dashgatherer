import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Athlete {
  user_id: string;
  user: {
    email: string;
  };
}

interface CoachDashboardProps {
  athletes?: Athlete[];
  selectedAthleteId: string | null;
  onAthleteSelect: (athleteId: string | null) => void;
}

const CoachDashboard = ({ 
  athletes = [], 
  selectedAthleteId,
  onAthleteSelect 
}: CoachDashboardProps) => {
  const selectedAthlete = athletes.find(a => a.user_id === selectedAthleteId);
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-4">
        {selectedAthlete && selectedAthlete.user ? selectedAthlete.user.email : "Coach Dashboard"}
      </h2>
      
      <div className="space-y-4">
        <div className="max-w-xs">
          <Select
            value={selectedAthleteId || ""}
            onValueChange={(value) => onAthleteSelect(value || null)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select an athlete" />
            </SelectTrigger>
            <SelectContent>
              {athletes.map((athlete) => (
                <SelectItem key={athlete.user_id} value={athlete.user_id}>
                  {athlete.user.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!selectedAthleteId && (
          <p className="text-gray-600">
            Please select an athlete from the dropdown above to view their training data.
          </p>
        )}
      </div>
    </div>
  );
};

export default CoachDashboard;