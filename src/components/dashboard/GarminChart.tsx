import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler, InteractionMode } from 'chart.js';
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, Edit, Trash, List, Plus, Calculator } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PremiumUpdateButton } from "./PremiumUpdateButton";
import { TRIMPCalculator } from "./TRIMPCalculator";
import { TSBPlanner } from "./TSBPlanner";

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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

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

export const GarminChart = ({
  data,
  email,
  onUpdate,
  isUpdating
}: Props) => {
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
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You need to be logged in to view your manual activities");
        return;
      }
      const {
        data: manualEntries,
        error
      } = await supabase.from('manual_data').select('*').eq('user_id', user.id).order('date', {
        ascending: false
      });
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

  const handleEditEntry = (entry: ManualData) => {
    setEditData(entry);
    setEditDate(new Date(entry.date));
    setEditTrimp(entry.trimp.toString());
    setEditActivityName(entry.activity_name);
    setIsEditing(true);
  };

  console.log('GarminChart data:', data);

  const uniqueDataMap = new Map();

  data.forEach(item => {
    const date = item.date;
    if (uniqueDataMap.has(date)) {
      const existing = uniqueDataMap.get(date);
      if (item.trimp > existing.trimp || 
          (item.activity !== 'Rest day' && existing.activity === 'Rest day')) {
        uniqueDataMap.set(date, item);
      }
    } else {
      uniqueDataMap.set(date, item);
    }
  });

  const uniqueData = Array.from(uniqueDataMap.values());

  const sortedData = [...uniqueData].sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime()
  });

  console.log('Sorted unique data:', sortedData);
  const reverseSortedData = [...sortedData].reverse();
  const latestData = reverseSortedData[0];
  console.log('Latest data:', latestData);

  const visibleDays = reverseSortedData.slice(0, visibleActivities);
  const hasMoreActivities = visibleActivities < reverseSortedData.length;
  const handleLoadMore = () => {
    setVisibleActivities(prev => prev + 10);
  };

  const tsb = latestData?.tsb;
  const status = tsb !== undefined && tsb !== null ? tsb < 0 ? 'Zmęczenie' : 'Wypoczęty' : 'No data';

  const getTsbStatus = (tsb: number | null | undefined) => {
    if (tsb === undefined || tsb === null) return {
      text: 'No data',
      color: 'text-gray-500'
    };
    if (tsb < -70) return {
      text: 'Bardzo duże zmęczenie',
      color: 'text-red-700'
    };
    if (tsb < 0) return {
      text: 'Zmęczenie',
      color: 'text-red-500'
    };
    if (tsb >= 0 && tsb <= 30) return {
      text: 'Optymalna forma',
      color: 'text-green-600'
    };
    return {
      text: 'Wypoczęty',
      color: 'text-blue-600'
    };
  };

  const chartData = {
    labels: sortedData.map(d => format(new Date(d.date), 'dd/MM/yyyy')),
    datasets: [{
      label: 'Acute Load (ATL)',
      data: sortedData.map(d => d.atl ?? 0),
      borderColor: 'rgb(59, 130, 246)',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      fill: true,
      tension: 0.4
    }, {
      label: 'Stress Balance (TSB)',
      data: sortedData.map(d => d.tsb ?? 0),
      borderColor: 'rgb(239, 68, 68)',
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      fill: true,
      tension: 0.4
    }, {
      label: 'Chronic Load (CTL)',
      data: sortedData.map(d => d.ctl ?? 0),
      borderColor: 'rgb(234, 179, 8)',
      backgroundColor: 'rgba(234, 179, 8, 0.1)',
      fill: true,
      tension: 0.4
    }]
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
        }
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
      }
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
    console.log('Form submitted with:', {
      date,
      trimp,
      activityName
    });
    try {
      setIsSubmitting(true);
      const formattedDate = format(date, 'yyyy-MM-dd');
      const trimpValue = parseFloat(trimp);
      if (isNaN(trimpValue)) {
        toast.error("Please enter a valid TRIMP value");
        logError("Invalid TRIMP value", {
          value: trimp
        }, {
          formattedDate
        });
        return;
      }
      if (!activityName) {
        toast.error("Please enter an activity name");
        logError("Missing activity name", null, {
          formattedDate,
          trimpValue
        });
        return;
      }
      console.log('🔍 Getting current user...');
      const {
        data: {
          user
        },
        error: userError
      } = await supabase.auth.getUser();
      if (userError) {
        logError("Failed to get current user", userError);
        toast.error("Authentication error. Please log in again.");
        return;
      }
      const currentUserId = user?.id;
      console.log('👤 Current user ID:', currentUserId);
      if (!currentUserId) {
        logError("No user ID available", null, {
          auth: "User not authenticated"
        });
        toast.error("Please log in to add training data");
        return;
      }
      const {
        data: existingEntry,
        error: existingEntryError
      } = await supabase.from('garmin_data').select('trimp, activity').eq('user_id', currentUserId).eq('date', formattedDate).single();
      if (existingEntryError && existingEntryError.code !== 'PGRST116') {
        logError("Error checking for existing entry", existingEntryError, {
          userId: currentUserId,
          date: formattedDate
        });
      }
      const {
        data: lastMetrics,
        error: lastMetricsError
      } = await supabase.from('garmin_data').select('atl, ctl, tsb').eq('user_id', currentUserId).lt('date', formattedDate).order('date', {
        ascending: false
      }).limit(1).single();
      if (lastMetricsError && lastMetricsError.code !== 'PGRST116') {
        logError("Error fetching last metrics", lastMetricsError, {
          userId: currentUserId,
          date: formattedDate
        });
      }
      console.log('Last metrics:', lastMetrics);
      console.log('Existing entry:', existingEntry);
      const previousMetrics = lastMetrics || {
        atl: 0,
        ctl: 0,
        tsb: 0
      };
      let combinedTrimp = trimpValue;
      let combinedActivities = [activityName];
      if (existingEntry) {
        combinedTrimp = existingEntry.trimp + trimpValue;
        let existingActivities = existingEntry.activity.split(', ').filter(a => a !== "Rest Day");
        combinedActivities = [...existingActivities, activityName];
      }
      console.log(`Combined TRIMP: ${combinedTrimp}, Combined Activities: ${combinedActivities.join(', ')}`);
      const newAtl = previousMetrics.atl + (combinedTrimp - previousMetrics.atl) / 7;
      const newCtl = previousMetrics.ctl + (combinedTrimp - previousMetrics.ctl) / 42;
      const newTsb = previousMetrics.ctl - previousMetrics.atl;
      console.log('New metrics:', {
        newAtl,
        newCtl,
        newTsb
      });
      const {
        error: upsertError
      } = await supabase.from('garmin_data').upsert({
        user_id: currentUserId,
        date: formattedDate,
        trimp: combinedTrimp,
        activity: combinedActivities.join(', '),
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
          trimp: combinedTrimp,
          activity: combinedActivities.join(', '),
          metrics: {
            atl: parseFloat(newAtl.toFixed(2)),
            ctl: parseFloat(newCtl.toFixed(2)),
            tsb: parseFloat(newTsb.toFixed(2))
          }
        });
        throw upsertError;
      }
      console.log("Inserting data into manual_data table...");
      const {
        error: manualDataError
      } = await supabase.from('manual_data').insert({
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
      toast.success(existingEntry ? "Training data added to existing activities!" : "Training data saved successfully!");
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
      const {
        data: subsequentDates,
        error: fetchError
      } = await supabase.from('garmin_data').select('date, trimp, atl, ctl, tsb').eq('user_id', currentUserId).gt('date', formattedDate).order('date', {
        ascending: true
      });
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
          const {
            error: updateError
          } = await supabase.from('garmin_data').update(updatedMetrics).eq('user_id', currentUserId).eq('date', dateItem.date);
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
      
      window.location.reload();
      
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
      const {
        error: updateError
      } = await supabase.from('manual_data').update({
        date: formattedDate,
        trimp: trimpValue,
        activity_name: editActivityName
      }).eq('id', editData.id);
      if (updateError) {
        console.error("Error updating manual data:", updateError);
        toast.error("Failed to update activity");
        return;
      }
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      const userId = user?.id;
      if (userId) {
        const {
          data: manualEntries,
          error: manualFetchError
        } = await supabase.from('manual_data').select('trimp, activity_name').eq('user_id', userId).eq('date', formattedDate);
        if (manualFetchError) {
          console.error("Error fetching manual data:", manualFetchError);
          toast.warning("Activity updated but training data may be incorrect");
          return;
        }
        const totalTrimp = manualEntries?.reduce((sum, entry) => sum + (entry.trimp || 0), 0) || 0;
        const allActivities = manualEntries?.map(entry => entry.activity_name).filter(Boolean) || [];
        if (userId) {
          const {
            data: garminEntry,
            error: garminFetchError
          } = await supabase.from('garmin_data').select('*').eq('user_id', userId).eq('date', formattedDate).maybeSingle();
          if (!garminFetchError) {
            const activityList = allActivities.join(', ');
            const activityData = {
              trimp: totalTrimp,
              activity: totalTrimp > 0 ? activityList : "Rest Day"
            };
            if (garminEntry) {
              const {
                error: garminUpdateError
              } = await supabase.from('garmin_data').update(activityData).eq('id', garminEntry.id);
              if (garminUpdateError) {
                console.error("Error updating garmin_data:", garminUpdateError);
                toast.warning("Manual activity updated but training data could not be fully updated");
              }
            }
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
      const {
        data: manualEntry,
        error: fetchError
      } = await supabase.from('manual_data').select('*').eq('id', entryId).single();
      if (fetchError) {
        console.error("Error fetching manual data before deletion:", fetchError);
        toast.error("Failed to retrieve activity details");
        return;
      }
      const trimpToRemove = manualEntry.trimp || 0;
      const activityNameToRemove = manualEntry.activity_name || "";
      const {
        error: deleteError
      } = await supabase.from('manual_data').delete().eq('id', entryId);
      if (deleteError) {
        console.error("Error deleting manual data:", deleteError);
        toast.error("Failed to delete activity");
        return;
      }
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      const userId = user?.id;
      if (userId) {
        const {
          data: remainingManual,
          error: remainingError
        } = await supabase.from('manual_data').select('trimp, activity_name').eq('user_id', userId).eq('date', entryDate);
        if (remainingError) {
          console.error("Error fetching remaining manual data:", remainingError);
        }
        const totalManualTrimp = remainingManual?.reduce((sum, entry) => sum + (entry.trimp || 0), 0) || 0;
        const manualActivities = remainingManual?.map(entry => entry.activity_name).filter(Boolean) || [];
        const {
          data: garminEntry,
          error: garminFetchError
        } = await supabase.from('garmin_data').select('*').eq('user_id', userId).eq('date', entryDate).maybeSingle();
        if (!garminFetchError && garminEntry) {
          const activityList = manualActivities.join(', ');
          const newActivity = totalManualTrimp > 0 ? activityList : "Rest Day";
          const {
            error: garminUpdateError
          } = await supabase.from('garmin_data').update({
            trimp: totalManualTrimp,
            activity: newActivity
          }).eq('user_id', userId).eq('date', entryDate);
          if (garminUpdateError) {
            console.error("Error updating garmin_data:", garminUpdateError);
            toast.warning("Activity deleted but training data could not be updated");
          } else {
            const {
              data: lastMetricsData,
              error: lastMetricsError
            } = await supabase.from('garmin_data').select('atl, ctl, tsb').eq('user_id', userId).lt('date', entryDate).order('date', {
              ascending: false
            }).limit(1).single();
            if (lastMetricsError && lastMetricsError.code !== 'PGRST116') {
              console.error("Error fetching last metrics:", lastMetricsError);
              toast.warning("Activity deleted but metrics may be incorrect");
              return;
            }
            const previousMetrics = lastMetricsData || {
              atl: 0,
              ctl: 0,
              tsb: 0
            };
            const newAtl = previousMetrics.atl + (totalManualTrimp - previousMetrics.atl) / 7;
            const newCtl = previousMetrics.ctl + (totalManualTrimp - previousMetrics.ctl) / 42;
            const newTsb = previousMetrics.ctl - previousMetrics.atl;
            await supabase.from('garmin_data').update({
              atl: parseFloat(newAtl.toFixed(2)),
              ctl: parseFloat(newCtl.toFixed(2)),
              tsb: parseFloat(newTsb.toFixed(2))
            }).eq('user_id', userId).eq('date', entryDate);
            const {
              data: subsequentDates,
              error: fetchDatesError
            } = await supabase.from('garmin_data').select('date, trimp').eq('user_id', userId).gt('date', entryDate).order('date', {
              ascending: true
            });
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
                await supabase.from('garmin_data').update(updatedMetrics).eq('user_id', userId).eq('date', dateItem.date);
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

  const LoadingOverlay = () => <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-50">
      <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
      <p className="text-lg font-medium text-gray-700">Loading training data...</p>
    </div>;

  const handleTRIMPCalculated = (value: number) => {
    setTrimp(value.toString());
  };

  return <div className="space-y-4 relative">
      {isInitialLoading && <LoadingOverlay />}
      
      <div className="flex justify-between items-center">
        <div className="flex flex-col">
          
          
        </div>
        <PremiumUpdateButton 
          onUpdate={onUpdate} 
          isUpdating={isUpdating} 
          isSubmitting={isSubmitting} 
        />
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
        {data.length === 0 && !isInitialLoading && !isUpdating && <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-gray-500 text-lg">No training data available</p>
          </div>}
        <Line data={chartData} options={options} />
      </div>

      <Tabs defaultValue="add" className="bg-white rounded-lg shadow-sm">
        <TabsList className="p-2 bg-muted/30">
          <TabsTrigger value="add">Add Training</TabsTrigger>
          <TabsTrigger value="planner">TSB Planner</TabsTrigger>
        </TabsList>
        
        <TabsContent value="add" className="p-6">
          <h3 className="text-lg font-semibold mb-4">Add Training Manually</h3>
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="z-[60] bg-white p-0" align="start">
                    <Calendar mode="single" selected={date} onSelect={newDate => newDate && setDate(newDate)} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2 relative">
                <Label htmlFor="trimp">TRIMP</Label>
                <Input id="trimp" type="number" min="0" step="1" value={trimp} onChange={e => setTrimp(e.target.value)} placeholder="e.g. 50" />
                <TRIMPCalculator onTRIMPCalculated={handleTRIMPCalculated} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="activity">Activity Name</Label>
                <Input id="activity" value={activityName} onChange={e => setActivityName(e.target.value)} placeholder="e.g. Running" />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={isSubmitting} className="gap-2">
                {isSubmitting ? <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </> : <>
                    <Plus className="h-4 w-4" />
                    Add Training
                  </>}
              </Button>
            </div>
          </form>
        </TabsContent>
        
        <TabsContent value="planner">
          <TSBPlanner 
            latestTSB={latestData?.tsb ?? null} 
            latestATL={latestData?.atl ?? null} 
            latestCTL={latestData?.ctl ?? null} 
          />
        </TabsContent>
      </Tabs>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="bg-white rounded-lg shadow-sm p-6">
        <TabsList className="mb-4">
          <TabsTrigger value="recent">
            Recent Activities
          </TabsTrigger>
          <TabsTrigger value="manual">
            Manual Activities
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="recent" className="space-y-4">
          <div className="bg-muted/30 rounded-md p-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Activity</TableHead>
                  <TableHead className="text-right">TRIMP</TableHead>
                  <TableHead className="text-right">ATL</TableHead>
                  <TableHead className="text-right">CTL</TableHead>
                  <TableHead className="text-right">TSB</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleDays.map((item, index) => <TableRow key={index}>
                    <TableCell className="font-medium">
                      {format(new Date(item.date), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      {item.activity}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.trimp}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.atl?.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.ctl?.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.tsb?.toFixed(1)}
                    </TableCell>
                  </TableRow>)}
              </TableBody>
            </Table>
            
            {hasMoreActivities && <div className="flex justify-center mt-4">
                <Button variant="outline" onClick={handleLoadMore} className="gap-2">
                  <List className="h-4 w-4" />
                  Load More
                </Button>
              </div>}
          </div>
        </TabsContent>
        
        <TabsContent value="manual" className="space-y-4">
          {isLoadingManual ? <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div> : <>
              {manualData.length === 0 ? <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-muted-foreground">No manual activities found</p>
                  <p className="text-sm text-muted-foreground mt-1">Add some training using the form above</p>
                </div> : <div className="bg-muted/30 rounded-md p-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Activity</TableHead>
                        <TableHead className="text-right">TRIMP</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {manualData.map(entry => <TableRow key={entry.id}>
                          <TableCell className="font-medium">
                            {format(new Date(entry.date), "dd MMM yyyy")}
                          </TableCell>
                          <TableCell>
                            {entry.activity_name}
                          </TableCell>
                          <TableCell className="text-right">
                            {entry.trimp}
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEditEntry(entry)} title="Edit entry">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteEntry(entry.id, entry.date)} title="Delete entry" className="text-destructive hover:text-destructive/90">
                              <Trash className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>)}
                    </TableBody>
                  </Table>
                </div>}
            </>}
          
          <Dialog open={isEditing} onOpenChange={open => !open && setIsEditing(false)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Training Entry</DialogTitle>
                <DialogDescription>
                  Update the details of your manual training entry.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-date">Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button id="edit-date" variant={"outline"} className={cn("w-full justify-start text-left font-normal", !editDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {editDate ? format(editDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="z-[60] bg-white p-0" align="start">
                      <Calendar mode="single" selected={editDate} onSelect={newDate => newDate && setEditDate(newDate)} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-trimp">TRIMP</Label>
                  <Input id="edit-trimp" type="number" min="0" step="1" value={editTrimp} onChange={e => setEditTrimp(e.target.value)} placeholder="e.g. 50" />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-activity">Activity Name</Label>
                  <Input id="edit-activity" value={editActivityName} onChange={e => setEditActivityName(e.target.value)} placeholder="e.g. Running" />
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateEntry} disabled={!editDate} className="gap-2">
                  {isEditing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : 'Save Changes'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>;
};
