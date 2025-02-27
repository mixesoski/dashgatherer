import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface TrainingDataInput {
  date: Date;
  trimp: string;
  activityName: string;
}

export const addTrainingData = async (data: TrainingDataInput): Promise<boolean> => {
  const { date, trimp, activityName } = data;
  console.log('Adding training data:', { date, trimp, activityName });
  
  try {
    const formattedDate = format(date, 'yyyy-MM-dd');
    const trimpValue = parseFloat(trimp);

    if (isNaN(trimpValue)) {
      toast.error("Please enter a valid TRIMP value");
      return false;
    }

    if (!activityName) {
      toast.error("Please enter an activity name");
      return false;
    }

    // Get current user ID from auth
    const { data: { user } } = await supabase.auth.getUser();
    const currentUserId = user?.id;

    if (!currentUserId) {
      toast.error("Please log in to add training data");
      return false;
    }

    // Check if entry exists for this date
    const { data: existingEntry } = await supabase
      .from('garmin_data')
      .select('trimp, activity')
      .eq('user_id', currentUserId)
      .eq('date', formattedDate)
      .maybeSingle();

    // Get the last metrics for calculation
    const { data: lastMetrics } = await supabase
      .from('garmin_data')
      .select('atl, ctl, tsb')
      .eq('user_id', currentUserId)
      .lt('date', formattedDate)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log('Last metrics:', lastMetrics);
    console.log('Existing entry:', existingEntry);

    const previousMetrics = lastMetrics || { atl: 0, ctl: 0, tsb: 0 };

    // Calculate new metrics based on previous day's metrics
    const newAtl = previousMetrics.atl + (trimpValue - previousMetrics.atl) / 7;
    const newCtl = previousMetrics.ctl + (trimpValue - previousMetrics.ctl) / 42;
    const newTsb = previousMetrics.ctl - previousMetrics.atl;  // TSB uses previous values

    console.log('New metrics:', { newAtl, newCtl, newTsb });

    // Use upsert with onConflict option
    const { error } = await supabase
      .from('garmin_data')
      .upsert({
        user_id: currentUserId,
        date: formattedDate,
        trimp: trimpValue,
        activity: activityName,
        atl: parseFloat(newAtl.toFixed(2)),
        ctl: parseFloat(newCtl.toFixed(2)),
        tsb: parseFloat(newTsb.toFixed(2))
      }, {
        onConflict: 'user_id,date'
      });

    if (error) throw error;

    toast.success(existingEntry 
      ? "Training data updated successfully!" 
      : "Training data saved successfully!");
    
    return true;

  } catch (error: any) {
    console.error('Error saving training data:', error);
    toast.error(error.message || "Failed to save training data");
    return false;
  }
}; 