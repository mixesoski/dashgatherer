import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { MoreVertical, User, KeyRound, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";

interface ProfileMenuProps {
  onDeleteGarminCredentials: () => Promise<void>;
}

export const ProfileMenu = ({ onDeleteGarminCredentials }: ProfileMenuProps) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handleChangePassword = () => {
    toast.info("Password change functionality coming soon");
  };

  const handleUpdateProfile = () => {
    toast.info("Profile update functionality coming soon");
  };

  return (
    <div className="flex gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="hover:bg-accent">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64">
          <DropdownMenuLabel className="font-semibold">Profile Settings</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem 
              onClick={handleUpdateProfile}
              className="flex items-center cursor-pointer"
            >
              <User className="mr-2 h-4 w-4" />
              <span>Update Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={handleChangePassword}
              className="flex items-center cursor-pointer"
            >
              <KeyRound className="mr-2 h-4 w-4" />
              <span>Change Password</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="font-semibold">Garmin Integration</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem
              className="text-destructive flex items-center cursor-pointer"
              onClick={onDeleteGarminCredentials}
            >
              <Settings className="mr-2 h-4 w-4" />
              <span>Remove Garmin Connection</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button onClick={handleLogout} variant="outline">
        Logout
      </Button>
    </div>
  );
};