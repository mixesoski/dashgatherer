
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ProgressToast } from "@/components/ui/ProgressToast";

const API_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || 'http://localhost:5001';

export const syncGarminData = async (userId: string, startDate: Date) => {
    try {
        const toastId = toast.loading(
            <ProgressToast message="Connecting to Garmin..." />,
            { duration: Infinity }
        );
        
        const { data: { user } } = await supabase.auth.getUser();
        console.log('Current user:', user);
        console.log('Using userId:', userId);
        console.log('Start date:', startDate);
        console.log('API URL:', `${API_URL}/api/sync-garmin`);
        
        if (!user || user.id !== userId) {
            toast.error('User authentication error', { id: toastId });
            return false;
        }

        // Update toast to show data fetching
        toast.loading(
            <ProgressToast message="Fetching activities from Garmin..." />,
            { id: toastId }
        );

        const response = await fetch(`${API_URL}/api/sync-garmin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                userId: user.id,
                startDate: startDate.toISOString()
            })
        });

        console.log('Raw response:', response);
        const data = await response.json();
        console.log('Response data:', data);
        
        if (data.success) {
            // Show progress messages
            if (data.newActivities > 0) {
                toast.loading(
                    <ProgressToast message="Processing new activities..." />,
                    { id: toastId }
                );
                await new Promise(resolve => setTimeout(resolve, 1000)); // Give time to read
                toast.loading(
                    <ProgressToast message="Calculating metrics..." />,
                    { id: toastId }
                );
                await new Promise(resolve => setTimeout(resolve, 1000)); // Give time to read
                toast.success(`Synced ${data.newActivities} new activities!`);
            } else {
                toast.success('Everything is up to date!');
            }
            return true;
        } else {
            toast.error(data.error || 'Sync failed', { id: toastId });
            return false;
        }
    } catch (error) {
        console.error('Error syncing:', error);
        toast.error('Error syncing data');
        return false;
    }
};

export const updateGarminData = async (userId: string) => {
    try {
        const toastId = toast.loading('Checking for new activities...', {
            duration: Infinity
        });
        
        const response = await fetch(`${API_URL}/api/update-chart`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            if (data.updated > 0) {
                toast.success(`Updated ${data.updated} activities!`, { 
                    id: toastId,
                    duration: 3000
                });
                return true;
            } else {
                toast.success('No new activities found', { 
                    id: toastId,
                    duration: 3000
                });
                return false;
            }
        } else {
            toast.error(data.error || 'Update failed', { id: toastId });
            return false;
        }
    } catch (error) {
        console.error('Error updating:', error);
        toast.error('Error updating data');
        return false;
    }
}; 
