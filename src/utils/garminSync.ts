import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const API_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || 'http://localhost:5001';

export const syncGarminData = async (userId: string, startDate: Date) => {
    try {
        const toastId = toast.loading('Syncing Garmin data...');
        
        const { data: { user } } = await supabase.auth.getUser();
        console.log('Current user:', user);
        console.log('Using userId:', userId);
        console.log('Start date:', startDate);
        console.log('API URL:', `${API_URL}/api/sync-garmin`);
        
        if (!user || user.id !== userId) {
            toast.error('User authentication error', { id: toastId });
            return false;
        }

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
            toast.success('Data synced successfully!', { id: toastId });
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
        const toastId = toast.loading('Checking for new activities...');
        
        // Get last 9 days
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 9);
        
        const response = await fetch(`${API_URL}/api/sync-garmin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                userId,
                startDate: startDate.toISOString(),
                updateOnly: true,
                recalculateOnly: false
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            if (data.newActivities > 0) {
                toast.success(`Updated: ${data.newActivities} new activities`, { id: toastId });
                return true;
            } else {
                toast.success('No new activities found', { id: toastId });
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