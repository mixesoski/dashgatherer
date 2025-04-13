
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getUserFriendlyErrorMessage } from "@/utils/errorMessages";

export const syncGarminData = async (userId: string, startDate: Date) => {
  const token = await getSupabaseToken();
  if (!token) {
    toast.error("You need to be logged in to sync your data");
    return false;
  }

  try {
    // Format date as ISO string
    const days = Math.ceil((new Date().getTime() - startDate.getTime()) / (1000 * 3600 * 24));
    
    // Call the API
    const apiUrl = import.meta.env.VITE_API_URL || 'https://dashgatherer-api.onrender.com';
    console.log("Using API URL:", apiUrl);
    
    const response = await fetch(`${apiUrl}/api/sync-garmin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      credentials: 'include',
      mode: 'cors',
      body: JSON.stringify({
        user_id: userId,
        days: days,
        is_first_sync: true
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || `HTTP Error: ${response.status}`;
      console.error("Sync error:", errorMessage);
      
      // Use our user-friendly error messages
      toast.error(getUserFriendlyErrorMessage({
        status: response.status,
        message: errorMessage
      }));
      
      return false;
    }

    const data = await response.json();
    console.log("Sync response:", data);
    
    if (!data.success) {
      const errorMessage = data.error || "Unknown error during sync";
      console.error("Sync failed:", errorMessage);
      
      toast.error(getUserFriendlyErrorMessage({
        message: errorMessage
      }));
      
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error syncing Garmin data:", error);
    toast.error(getUserFriendlyErrorMessage(error));
    return false;
  }
};

export const updateGarminData = async (userId: string) => {
  const token = await getSupabaseToken();
  if (!token) {
    toast.error("You need to be logged in to update your data");
    return false;
  }

  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'https://dashgatherer-api.onrender.com';
    console.log("Using API URL:", apiUrl);
    
    const response = await fetch(`${apiUrl}/api/update-chart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      credentials: 'include',
      mode: 'cors',
      body: JSON.stringify({
        userId,
        forceRefresh: true
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || `HTTP Error: ${response.status}`;
      console.error("Update error:", errorMessage);
      
      toast.error(getUserFriendlyErrorMessage({
        status: response.status,
        message: errorMessage
      }));
      
      return false;
    }

    const data = await response.json();
    console.log("Update response:", data);
    
    if (!data.success) {
      const errorMessage = data.error || "Unknown error during update";
      console.error("Update failed:", errorMessage);
      
      toast.error(getUserFriendlyErrorMessage({
        message: errorMessage
      }));
      
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error updating Garmin data:", error);
    toast.error(getUserFriendlyErrorMessage(error));
    return false;
  }
};

// Helper function to get Supabase token
const getSupabaseToken = async (): Promise<string | null> => {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  } catch (error) {
    console.error("Error getting auth token:", error);
    toast.error(getUserFriendlyErrorMessage(error));
    return null;
  }
};
