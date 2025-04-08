
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ProgressToast } from "@/components/ui/ProgressToast";
import { Loader2 } from "lucide-react";

// Ensure we're using the correct API URL
const API_URL = import.meta.env.PROD 
  ? 'https://trimpbara.onrender.com'
  : (import.meta.env.VITE_API_URL || 'http://localhost:5001');

// Debug logging
console.log('Environment variables:', {
    VITE_API_URL: import.meta.env.VITE_API_URL,
    API_URL: API_URL,
    NODE_ENV: import.meta.env.MODE,
    PROD: import.meta.env.PROD,
    DEV: import.meta.env.DEV
});

export const syncGarminData = async (userId: string, startDate: Date) => {
    try {
        // Create a persistent toast with loading animation and first sync message
        const toastId = toast.loading(
            <div className="flex flex-col space-y-2">
                <ProgressToast message="Connecting to Garmin..." />
                <p className="text-xs text-muted-foreground italic">First sync might take a while</p>
            </div>,
            { duration: Infinity, position: window.innerWidth < 768 ? 'bottom-center' : 'top-right' }
        );
        
        const { data: { user } } = await supabase.auth.getUser();
        const { data: sessionData } = await supabase.auth.getSession();
        const authToken = sessionData.session?.access_token;
        
        console.log('Current user:', user);
        console.log('Using userId:', userId);
        console.log('Start date:', startDate);
        
        if (!user || user.id !== userId) {
            toast.error('User authentication error', { 
                id: toastId,
                position: window.innerWidth < 768 ? 'bottom-center' : 'top-right'
            });
            return false;
        }

        // Update toast to show data fetching
        toast.loading(
            <div className="flex flex-col space-y-2">
                <ProgressToast message="Fetching activities from Garmin..." />
                <p className="text-xs text-muted-foreground italic">First sync might take a while</p>
            </div>,
            { 
                id: toastId,
                position: window.innerWidth < 768 ? 'bottom-center' : 'top-right'
            }
        );

        // Calculate days from start date until now
        const daysDiff = Math.ceil((new Date().getTime() - startDate.getTime()) / (1000 * 3600 * 24));
        
        const response = await fetch(`${API_URL}/api/sync-garmin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ 
                user_id: user.id,
                days: daysDiff,
                is_first_sync: false
            })
        });

        console.log('Raw response:', response);
        const data = await response.json();
        console.log('Response data:', data);
        
        if (data.success) {
            // Show success message
            if (data.newActivities > 0) {
                toast.success(`Synced ${data.newActivities} new activities!`, { 
                    id: toastId,
                    position: window.innerWidth < 768 ? 'bottom-center' : 'top-right'
                });
            } else {
                toast.success('Everything is up to date!', { 
                    id: toastId,
                    position: window.innerWidth < 768 ? 'bottom-center' : 'top-right'
                });
            }
            return true;
        } else {
            toast.error(data.error || 'Sync failed', { 
                id: toastId,
                position: window.innerWidth < 768 ? 'bottom-center' : 'top-right'
            });
            return false;
        }
    } catch (error) {
        console.error('Error syncing:', error);
        toast.error('Error syncing data', {
            position: window.innerWidth < 768 ? 'bottom-center' : 'top-right'
        });
        return false;
    }
};

export const updateGarminData = async (userId: string) => {
    try {
        const toastId = toast.loading(
            <div className="flex flex-col space-y-2">
                <ProgressToast message="Checking for new activities..." />
                <p className="text-xs text-muted-foreground italic">This may take a moment</p>
            </div>,
            {
                duration: Infinity,
                position: window.innerWidth < 768 ? 'bottom-center' : 'top-right'
            }
        );
        
        const { data: sessionData } = await supabase.auth.getSession();
        const authToken = sessionData.session?.access_token;
        
        console.log('Updating Garmin data for user:', userId);
        
        // Add a timestamp to force server to refresh Garmin data instead of using cache
        const timestamp = new Date().getTime();
        
        const response = await fetch(`${API_URL}/api/update-chart?t=${timestamp}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
                'Cache-Control': 'no-cache, no-store'
            },
            body: JSON.stringify({ 
                userId,
                forceRefresh: true // Add parameter to indicate we want to force a fresh check
            })
        });
        
        console.log('Raw update response:', response);
        const data = await response.json();
        console.log('Update response data:', data);
        
        if (data.success) {
            if (data.updated > 0) {
                toast.success(`Updated ${data.updated} activities!`, { 
                    id: toastId,
                    duration: 3000,
                    position: window.innerWidth < 768 ? 'bottom-center' : 'top-right'
                });
                return true;
            } else {
                toast.success('No new activities found', { 
                    id: toastId,
                    duration: 3000,
                    position: window.innerWidth < 768 ? 'bottom-center' : 'top-right'
                });
                return false;
            }
        } else {
            toast.error(data.error || 'Update failed', { 
                id: toastId,
                position: window.innerWidth < 768 ? 'bottom-center' : 'top-right'
            });
            return false;
        }
    } catch (error) {
        console.error('Error updating:', error);
        toast.error('Error syncing data', {
            position: window.innerWidth < 768 ? 'bottom-center' : 'top-right'
        });
        return false;
    }
};
