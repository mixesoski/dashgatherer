import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  InteractionMode
} from 'chart.js';
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, Edit, Trash, List, Plus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const logError = (message: string, error: any, additionalInfo?: any) => {
  console.error("\n" + "=".repeat(50));
  console.error(`ERROR: ${message}`);
  console.error(`TIMESTAMP: ${new Date().toISOString()}`);
  
  if (error) {
    console.error(`ERROR TYPE: ${error.name || typeof error}`);
    console.error(`ERROR MESSAGE: ${error.message || String(error)}`);
    
    if (error.stack) {
      console.error("\nSTACK TRACE:");
      console.error(error.stack);
    }
    
    if (error.cause) {
      console.error(`\nCAUSE: ${error.cause}`);
    }
  }
  
  if (additionalInfo) {
    console.error("\nADDITIONAL INFO:");
    console.error(additionalInfo);
  }
  
  console.error("=".repeat(50) + "\n");
};

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface GarminData {
  date: string;
  trimp: number;
  activity: string;
  atl: number | null;
  ctl: number | null;
  tsb: number | null;
}

interface ManualData {
  id: number;
  user_id: string;
  date: string;
  trimp: number;
  activity_name: string;
  created_at: string;
}

interface Props {
  data: GarminData[];
  email: string;
  onUpdate: () => Promise<void>;
  isUpdating?: boolean;
}

export const GarminChart = ({ data, email, onUpdate, isUpdating }: Props) => {
  const [visibleActivities, setVisibleActivities] = useState(10);
  const [date, setDate] = useState<Date>(new Date());
  const [trimp, setTrimp] = useState("");
  const [activityName, setActivityName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [manualData, setManualData] = useState<ManualData[]>([]);
  const [isLoadingManual, setIsLoadingManual] = useState(false);
  const [editData, setEditData] = useState<ManualData | null>(null);
  const [editDate, setEditDate] = useState<Date | undefined>(undefined);
  const [editTrimp, setEditTrimp] = useState("");
  const [editActivityName, setEditActivityName] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("recent");

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (activeTab === "manual") {
      fetchManualData();
    }
  }, [activeTab]);

  const fetchManualData = async () => {
    try {
      setIsLoadingManual(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You need to be logged in to view your manual activities");
        return;
      }
      
      const { data: manualEntries, error } = await supabase
        .from('manual_data')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });
        
      if (error) {
        console.error("Error fetching manual data:", error);
        toast.error("Failed to load manual activities");
        return;
      }
      
      setManualData(manualEntries || []);
    } catch (err) {
      console.error("Error in fetchManualData:", err);
      toast.error("An error occurred while loading manual activities");
    } finally {
      setIsLoadingManual(false);
    }
  };

  console.log('GarminChart data:', data);
  
  const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  console.log('Sorted data:', sortedData);
  
  const reverseSortedData = [...sortedData].reverse();
  const latestData = reverseSortedData[0];
  console.log('Latest data:', latestData);
  
  const visibleDays = reverseSortedData.slice(0, visibleActivities);
  
  const hasMoreActivities = visibleActivities < reverseSortedData.length;

  const handleLoadMore = () => {
    setVisibleActivities(prev => prev + 10);
  };

  const tsb = latestData?.tsb;
  const status = (tsb !== undefined && tsb !== null)
    ? (tsb < 0 ? 'Zmęczenie' : 'Wypoczęty')
    : 'No data';

  const getTsbStatus = (tsb: number | null | undefined) => {
    if (tsb === undefined || tsb === null) return { text: 'No data', color: 'text-gray-500' };
    
    if (tsb < -70) return { text: 'Bardzo duże zmęczenie', color: 'text-red-700' };
    if (tsb < 0) return { text: 'Zmęczenie', color: 'text-red-500' };
    if (tsb >= 0 && tsb <= 30) return { text: 'Optymalna forma', color: 'text-green-600' };
    return { text: 'Wypoczęty', color: 'text-blue-600' };
  };

  const chartData = {
    labels: sortedData.map(d => format(new Date(d.date), 'dd/MM/yyyy')),
    datasets: [
      {
        label: 'Acute Load (ATL)',
        data: sortedData.map(d => d.atl ?? 0),
        borderColor: 'rgb(59, 130, 246)', // Blue
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Stress Balance (TSB)',
        data: sortedData.map(d => d.tsb ?? 0),
        borderColor: 'rgb(239, 68, 68)', // Red
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Chronic Load (CTL)',
        data: sortedData.map(d => d.ctl ?? 0),
        borderColor: 'rgb(234, 179, 8)', // Yellow
        backgroundColor: 'rgba(234, 179, 8, 0.1)',
        fill: true,
        tension: 0.4,
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            family: 'Inter'
          }
        },
      },
      title: {
        display: true,
        text: 'Performance Metrics',
        align: 'start' as const,
        padding: {
          bottom: 30
        },
        font: {
          size: 24,
          weight: 'bold' as const,
          family: 'Inter'
        }
      },
    },
    scales: {
      x: {
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          font: {
            family: 'Inter'
          }
        }
      },
      y: {
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          callback: (value: number) => Math.round(value * 10) / 10,
          font: {
            family: 'Inter'
          }
        }
      }
    },
    elements: {
      point: {
        radius: 0
      },
      line: {
        borderWidth: 2
      }
    },
    interaction: {
      intersect: false,
      mode: 'index' as InteractionMode
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('\n' + '='.repeat(50));
    console.log('📝 MANUAL TRAINING SUBMISSION STARTED');
    console.log('Form submitted with:', { date, trimp, activityName });
    
    try {
      setIsSubmitting(true);
      const formattedDate = format(date, 'yyyy-MM-dd');
      const trimpValue = parseFloat(trimp);

      if (isNaN(trimpValue)) {
        toast.error("Please enter a valid TRIMP value");
        logError("Invalid TRIMP value", { value: trimp }, { formattedDate });
        return;
      }

      if (!activityName) {
        toast.error("Please enter an activity name");
        logError("Missing activity name", null, { formattedDate, trimpValue });
        return;
      }

      console.log('🔍 Getting current user...');
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        logError("Failed to get current user", userError);
        toast.error("Authentication error. Please log in again.");
        return;
      }
      
      const currentUserId = user?.id;
      console.log('👤 Current user ID:', currentUserId);

      if (!currentUserId) {
        logError("No user ID available", null, { auth: "User not authenticated" });
        toast.error("Please log in to add training data");
        return;
      }

      const { data: existingEntry, error: existingEntryError } = await supabase
        .from('garmin_data')
        .select('trimp, activity')
        .eq('user_id', currentUserId)
        .eq('date', formattedDate)
        .single();

      if (existingEntryError && existingEntryError.code !== 'PGRST116') {
        logError("Error checking for existing entry", existingEntryError, { 
          userId: currentUserId, 
          date: formattedDate 
        });
      }

      const { data: lastMetrics, error: lastMetricsError } = await supabase
        .from('garmin_data')
        .select('atl, ctl, tsb')
        .eq('user_id', currentUserId)
        .lt('date', formattedDate)
        .order('date', { ascending: false })
        .limit(1)
        .single();

      if (lastMetricsError && lastMetricsError.code !== 'PGRST116') {
        logError("Error fetching last metrics", lastMetricsError, { 
          userId: currentUserId, 
          date: formattedDate 
        });
      }

      console.log('Last metrics:', lastMetrics);
      console.log('Existing entry:', existingEntry);

      const previousMetrics = lastMetrics || { atl: 0, ctl: 0, tsb: 0 };

      const newAtl = previousMetrics.atl + (trimpValue - previousMetrics.atl) / 7;
      const newCtl = previousMetrics.ctl + (trimpValue - previousMetrics.ctl) / 42;
      const newTsb = previousMetrics.ctl - previousMetrics.atl;

      console.log('New metrics:', { newAtl, newCtl, newTsb });

      const { error: upsertError } = await supabase
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

      if (upsertError) {
        logError("Error upserting training data", upsertError, {
          userId: currentUserId,
          date: formattedDate,
          trimp: trimpValue,
          activity: activityName,
          metrics: {
            atl: parseFloat(newAtl.toFixed(2)),
            ctl: parseFloat(newCtl.toFixed(2)),
            tsb: parseFloat(newTsb.toFixed(2))
          }
        });
        throw upsertError;
      }

      console.log("Inserting data into manual_data table...");
      
      const { error: manualDataError } = await supabase
        .from('manual_data')
        .insert({
          user_id: currentUserId,
          date: formattedDate,
          trimp: trimpValue,
          activity_name: activityName
        });
      
      if (manualDataError) {
        console.error("❌ Error inserting into manual_data table:", manualDataError.message);
        logError("Error inserting into manual_data table", manualDataError, {
          userId: currentUserId,
          date: formattedDate,
          trimp: trimpValue,
          activity_name: activityName
        });
        toast.warning("Training data saved but couldn't be added to history");
      } else {
        console.log("✅ Successfully inserted data into manual_data table");
      }

      toast.success(existingEntry 
        ? "Training data updated successfully!" 
        : "Training data saved successfully!");
      
      setTrimp("");
      setActivityName("");
      
      try {
        await onUpdate();
        if (activeTab === "manual") {
          await fetchManualData();
        }
      } catch (updateError) {
        logError("Error refreshing data", updateError);
      }
      
      console.log("Recalculating metrics for subsequent dates...");
      
      const { data: subsequentDates, error: fetchError } = await supabase
        .from('garmin_data')
        .select('date, trimp, atl, ctl, tsb')
        .eq('user_id', currentUserId)
        .gt('date', formattedDate)
        .order('date', { ascending: true });
          
      if (fetchError) {
        logError("Error fetching subsequent dates", fetchError, {
          userId: currentUserId,
          startDate: formattedDate
        });
        throw fetchError;
      }
          
      if (subsequentDates && subsequentDates.length > 0) {
        console.log(`Found ${subsequentDates.length} subsequent dates to recalculate`);
        
        let prevMetrics = {
          atl: parseFloat(newAtl.toFixed(2)),
          ctl: parseFloat(newCtl.toFixed(2)),
          tsb: parseFloat(newTsb.toFixed(2))
        };
        
        console.log("Starting recalculation with metrics:", prevMetrics);
        
        for (const dateItem of subsequentDates) {
          const dateTRIMP = dateItem.trimp || 0;
          
          const dateAtl = prevMetrics.atl + (dateTRIMP - prevMetrics.atl) / 7;
          const dateCtl = prevMetrics.ctl + (dateTRIMP - prevMetrics.ctl) / 42;
          const dateTsb = prevMetrics.ctl - prevMetrics.atl;
          
          const updatedMetrics = {
            atl: parseFloat(dateAtl.toFixed(2)),
            ctl: parseFloat(dateCtl.toFixed(2)),
            tsb: parseFloat(dateTsb.toFixed(2))
          };
          
          console.log(`Updating ${dateItem.date} - TRIMP: ${dateTRIMP}, New metrics:`, updatedMetrics);
          
          const { error: updateError } = await supabase
            .from('garmin_data')
            .update(updatedMetrics)
            .eq('user_id', currentUserId)
            .eq('date', dateItem.date);
          
          if (updateError) {
            logError(`Error updating metrics for ${dateItem.date}`, updateError, {
              userId: currentUserId,
              date: dateItem.date,
              metrics: updatedMetrics
            });
            throw updateError;
          }
          
          prevMetrics = updatedMetrics;
        }
        
        console.log("Finished recalculating metrics for all subsequent dates");
        try {
          await onUpdate();
        } catch (finalUpdateError) {
          logError("Error refreshing chart after recalculation", finalUpdateError);
        }
      } else {
        console.log("No subsequent dates found that need recalculation");
      }
      
      console.log('✅ MANUAL TRAINING SUBMISSION COMPLETED SUCCESSFULLY');
      console.log('='.repeat(50) + '\n');
    } catch (error: any) {
      console.log('❌ MANUAL TRAINING SUBMISSION FAILED');
      console.log('='.repeat(50) + '\n');
      logError('Error saving training data', error, {
        date: format(date, 'yyyy-MM-dd'),
        trimp: trimp,
        activityName: activityName
      });
      toast.error(error.message || "Failed to save training data");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditEntry = (entry: ManualData) => {
    setEditData(entry);
    setEditDate(new Date(entry.date));
    setEditTrimp(entry.trimp.toString());
    setEditActivityName(entry.activity_name);
    setIsEditing(true);
  };

  const handleUpdateEntry = async () => {
    if (!editData || !editDate) return;

    try {
      setIsEditing(true);
      const formattedDate = format(editDate, 'yyyy-MM-dd');
      const trimpValue = parseFloat(editTrimp);

      if (isNaN(trimpValue)) {
        toast.error("Please enter a valid TRIMP value");
        return;
      }

      if (!editActivityName) {
        toast.error("Please enter an activity name");
        return;
      }

      const { error: updateError } = await supabase
        .from('manual_data')
        .update({
          date: formattedDate,
          trimp: trimpValue,
          activity_name: editActivityName
        })
        .eq('id', editData.id);

      if (updateError) {
        console.error("Error updating manual data:", updateError);
        toast.error("Failed to update activity");
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;

      if (userId) {
        const { data: garminEntry, error: garminFetchError } = await supabase
          .from('garmin_data')
          .select('*')
          .eq('user_id', userId)
          .eq('date', formattedDate)
          .maybeSingle();

        if (!garminFetchError && garminEntry) {
          const { error: garminUpdateError } = await supabase
            .from('garmin_data')
            .update({
              trimp: trimpValue,
              activity: editActivityName
            })
            .eq('id', garminEntry.id);

          if (garminUpdateError) {
            console.error("Error updating garmin_data:", garminUpdateError);
          }
        }
      }

      toast.success("Activity updated successfully");
      await fetchManualData();
      await onUpdate();
      setIsEditing(false);
      setEditData(null);
    } catch (error) {
      console.error("Error in handleUpdateEntry:", error);
      toast.error("An error occurred while updating the activity");
    } finally {
      setIsEditing(false);
    }
  };

  const handleDeleteEntry = async (entryId: number, entryDate: string) => {
    try {
      const { data: manualEntry, error: fetchError } = await supabase
        .from('manual_data')
        .select('*')
        .eq('id', entryId)
        .single();

      if (fetchError) {
        console.error("Error fetching manual data before deletion:", fetchError);
        toast.error("Failed to retrieve activity details");
        return;
      }

      const trimpToRemove = manualEntry.trimp || 0;
      const activityNameToRemove = manualEntry.activity_name || "";

      const { error: deleteError } = await supabase
        .from('manual_data')
        .delete()
        .eq('id', entryId);

      if (deleteError) {
        console.error("Error deleting manual data:", deleteError);
        toast.error("Failed to delete activity");
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;

      if (userId) {
        const { data: garminEntry, error: garminFetchError } = await supabase
          .from('garmin_data')
          .select('*')
          .eq('user_id', userId)
          .eq('date', entryDate)
          .maybeSingle();

        if (!garminFetchError && garminEntry) {
          const newTrimp = Math.max(0, garminEntry.trimp - trimpToRemove);
          
          let activities = garminEntry.activity.split(', ').filter(a => a !== "Rest Day");
          
          activities = activities.filter(a => a !== activityNameToRemove);
          
          const newActivity = activities.length > 0 ? activities.join(', ') : "Rest Day";

          const { error: garminUpdateError } = await supabase
            .from('garmin_data')
            .update({
              trimp: newTrimp,
              activity: newActivity
            })
            .eq('user_id', userId)
            .eq('date', entryDate);

          if (garminUpdateError) {
            console.error("Error updating garmin_data:", garminUpdateError);
            toast.warning("Activity deleted but training data could not be updated");
          } else {
            const { data: lastMetricsData, error: lastMetricsError } = await supabase
              .from('garmin_data')
              .select('atl, ctl, tsb')
              .eq('user_id', userId)
              .lt('date', entryDate)
              .order('date', { ascending: false })
              .limit(1)
              .single();
              
            if (lastMetricsError && lastMetricsError.code !== 'PGRST116') {
              console.error("Error fetching last metrics:", lastMetricsError);
              toast.warning("Activity deleted but metrics may be incorrect");
              return;
            }
            
            const previousMetrics = lastMetricsData || { atl: 0, ctl: 0, tsb: 0 };
            
            const newAtl = previousMetrics.atl + (newTrimp - previousMetrics.atl) / 7;
            const newCtl = previousMetrics.ctl + (newTrimp - previousMetrics.ctl) / 42;
            const newTsb = previousMetrics.ctl - previousMetrics.atl;
            
            await supabase
              .from('garmin_data')
              .update({
                atl: parseFloat(newAtl.toFixed(2)),
                ctl: parseFloat(newCtl.toFixed(2)),
                tsb: parseFloat(newTsb.toFixed(2))
              })
              .eq('user_id', userId)
              .eq('date', entryDate);
            
            const { data: subsequentDates, error: fetchDatesError } = await supabase
              .from('garmin_data')
              .select('date, trimp')
              .eq('user_id', userId)
              .gt('date', entryDate)
              .order('date', { ascending: true });
              
            if (!fetchDatesError && subsequentDates && subsequentDates.length > 0) {
              let prevMetrics = {
                atl: parseFloat(newAtl.toFixed(2)),
                ctl: parseFloat(newCtl.toFixed(2)),
                tsb: parseFloat(newTsb.toFixed(2))
              };
              
              for (const dateItem of subsequentDates) {
                const dateTRIMP = dateItem.trimp || 0;
                
                const dateAtl = prevMetrics.atl + (dateTRIMP - prevMetrics.atl) / 7;
                const dateCtl = prevMetrics.ctl + (dateTRIMP - prevMetrics.ctl) / 42;
                const dateTsb = prevMetrics.ctl - prevMetrics.atl;
                
                const updatedMetrics = {
                  atl: parseFloat(dateAtl.toFixed(2)),
                  ctl: parseFloat(dateCtl.toFixed(2)),
                  tsb: parseFloat(dateTsb.toFixed(2))
                };
                
                await supabase
                  .from('garmin_data')
                  .update(updatedMetrics)
                  .eq('user_id', userId)
                  .eq('date', dateItem.date);
                
                prevMetrics = updatedMetrics;
              }
            }
          }
        }
      }

      toast.success("Activity deleted successfully");
      await fetchManualData();
      await onUpdate();
    } catch (error) {
      console.error("Error in handleDeleteEntry:", error);
      toast.error("An error occurred while deleting the activity");
    }
  };

  const LoadingOverlay = () => (
    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-50">
      <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
      <p className="text-lg font-medium text-gray-700">Loading training data...</p>
    </div>
  );

  return (
    <div className="space-y-4 relative">
      {(isInitialLoading) && <LoadingOverlay />}
      
      <div className="flex justify-between items-center">
        <div className="flex flex-col">
          <h2 className="text-2xl font-bold">{email}</h2>
          <p className="text-gray-600">Training load balance over time</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onUpdate}
          disabled={isUpdating || isSubmitting}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isUpdating ? 'animate-spin' : ''}`} />
          Update Chart
        </Button>
      </div>
      
      <div className="bg-white/90 backdrop-blur-sm rounded-lg p-3 border shadow-sm w-72 ml-auto">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">Status:</span>
            <span className={`${getTsbStatus(latestData?.tsb).color} font-semibold`}>
              {getTsbStatus(latestData?.tsb).text}
            </span>
          </div>
          
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="flex flex-col items-center">
              <span className="text-blue-600 font-medium whitespace-nowrap">ATL</span>
              <span className="text-sm">{latestData?.atl?.toFixed(1) ?? 'N/A'}</span>
              <span className="text-[10px] text-gray-500">Zmęczenie</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-yellow-600 font-medium whitespace-nowrap">CTL</span>
              <span className="text-sm">{latestData?.ctl?.toFixed(1) ?? 'N/A'}</span>
              <span className="text-[10px] text-gray-500">Wydolność</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-red-600 font-medium whitespace-nowrap">TSB</span>
              <span className="text-sm">{latestData?.tsb?.toFixed(1) ?? 'N/A'}</span>
              <span className="text-[10px] text-gray-500">Forma</span>
            </div>
          </div>
          
          <div className="text-center text-[10px] text-gray-500 pt-1 border-t">
            {new Date(latestData?.date ?? '').toLocaleDateString()}
          </div>
        </div>
      </div>

      <div className="w-full h-[600px] bg-white rounded-lg p-6 shadow-sm relative">
        {data.length === 0 && !isInitialLoading && !isUpdating && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-gray-500 text-lg">No training data available</p>
          </div>
        )}
        <Line data={chartData} options={options} />
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6 relative">
        <h3 className="text-lg font-semibold mb-4">Add Training Manually</h3>
        <form onSubmit={handleManualSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="z-[60] bg-white p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(newDate) => newDate && setDate(newDate)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="trimp">TRIMP Value</Label>
              <Input
                id="trimp"
                type="number"
                step="0.1"
                min="0"
                value={trimp}
                onChange={(e) => setTrimp(e.target.value)}
                placeholder="Enter TRIMP value"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="activity">Activity Name</Label>
              <Input
                id="activity"
                type="text"
                value={activityName}
                onChange={(e) => setActivityName(e.target.value)}
                placeholder="Enter activity name"
                required
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Training"
              )}
            </Button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <Tabs defaultValue="recent" value={activeTab} onValueChange={setActiveTab}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Activities</h3>
            <TabsList>
              <TabsTrigger value="recent" className="flex items-center gap-1">
                <List className="h-4 w-4" />
                <span>Recent Activities</span>
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex items-center gap-1">
                <Plus className="h-4 w-4" />
                <span>Manual Activities</span>
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="recent">
            {data.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No recent activities</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Activity</TableHead>
                      <TableHead className="text-right">TRIMP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleDays.map((day) => (
                      <TableRow key={day.date}>
                        <TableCell>{format(new Date(day.date), 'dd/MM/yyyy')}</TableCell>
                        <TableCell>{day.activity}</TableCell>
                        <TableCell className="text-right">{day.trimp.toFixed(1)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {hasMoreActivities && (
                  <div className="mt-4 flex justify-center">
                    <Button 
                      variant="outline"
                      onClick={handleLoadMore}
                      className="w-full sm:w-auto"
                    >
                      Load More Activities
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>
          
          <TabsContent value="manual">
            {isLoadingManual ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
            ) : manualData.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No manual activities found</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Activity</TableHead>
                    <TableHead className="text-right">TRIMP</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {manualData.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{format(new Date(entry.date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>{entry.activity_name}</TableCell>
                      <TableCell className="text-right">{entry.trimp.toFixed(1)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditEntry(entry)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteEntry(entry.id, entry.date)}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
        
        <Dialog open={isEditing} onOpenChange={(open) => !open && setIsEditing(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Activity</DialogTitle>
              <DialogDescription>
                Update the details of your manual training activity.
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-date">Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="edit-date"
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !editDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editDate ? format(editDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="z-[60] bg-white p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={editDate}
                      onSelect={(newDate) => newDate && setEditDate(newDate)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-trimp">TRIMP Value</Label>
                <Input
                  id="edit-trimp"
                  type="number"
                  step="0.1"
                  min="0"
                  value={editTrimp}
                  onChange={(e) => setEditTrimp(e.target.value)}
                  placeholder="Enter TRIMP value"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-activity">Activity Name</Label>
                <Input
                  id="edit-activity"
                  type="text"
                  value={editActivityName}
                  onChange={(e) => setEditActivityName(e.target.value)}
                  placeholder="Enter activity name"
                  required
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateEntry} disabled={!editDate || !editTrimp || !editActivityName}>
                {isEditing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Activity"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
