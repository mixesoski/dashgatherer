import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface ProfileMenuProps {
  onDeleteGarminCredentials: () => void;
}

export const ProfileMenu = ({ onDeleteGarminCredentials }: ProfileMenuProps) => {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Error signing out");
      return;
    }
    navigate("/login");
  };

  const handleDeleteAllData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('You must be logged in to delete your data');
        return;
      }

      const { error } = await supabase
        .from('garmin_data')
        .delete()
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting data:', error);
        toast.error('Failed to delete data');
        return;
      }

      toast.success('All your data has been deleted');
      // Refresh the page to update the UI
      window.location.reload();
    } catch (error) {
      console.error('Error:', error);
      toast.error('An unexpected error occurred');
    }
  };

  const handleDeleteGarminCredentials = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('You must be logged in to delete your credentials');
        return;
      }

      // Update profiles table to clear Garmin credentials
      const { error: profilesError } = await supabase
        .from('profiles')
        .update({
          garmin_email: null,
          garmin_password: null
        })
        .eq('user_id', user.id);

      if (profilesError) {
        console.error('Error updating profiles:', profilesError);
        toast.error('Failed to delete Garmin credentials from profiles');
        return;
      }

      // Call the original handler to delete from garmin_credentials table
      await onDeleteGarminCredentials();

      toast.success('Garmin credentials deleted successfully');
    } catch (error) {
      console.error('Error:', error);
      toast.error('An unexpected error occurred');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Menu</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleDeleteGarminCredentials}
          className="text-red-600 cursor-pointer"
        >
          Delete Garmin Credentials
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleDeleteAllData}
          className="text-red-600 cursor-pointer"
        >
          Delete All My Data
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};