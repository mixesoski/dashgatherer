import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { MoreVertical, User, KeyRound, Settings } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuLabel,
  ContextMenuGroup,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
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
    navigate("/settings/password");
  };

  const handleUpdateProfile = () => {
    toast.info("Profile update functionality coming soon");
    navigate("/settings/profile");
  };

  return (
    <div className="flex gap-2">
      <ContextMenu>
        <ContextMenuTrigger>
          <Button variant="outline" size="icon" className="hover:bg-accent">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-64">
          <ContextMenuLabel className="font-semibold">Profile Settings</ContextMenuLabel>
          <ContextMenuGroup>
            <ContextMenuItem 
              onClick={handleUpdateProfile}
              className="flex items-center cursor-pointer"
            >
              <User className="mr-2 h-4 w-4" />
              <span>Update Profile</span>
            </ContextMenuItem>
            <ContextMenuItem 
              onClick={handleChangePassword}
              className="flex items-center cursor-pointer"
            >
              <KeyRound className="mr-2 h-4 w-4" />
              <span>Change Password</span>
            </ContextMenuItem>
          </ContextMenuGroup>
          <ContextMenuSeparator />
          <ContextMenuLabel className="font-semibold">Garmin Integration</ContextMenuLabel>
          <ContextMenuGroup>
            <ContextMenuItem
              className="text-destructive flex items-center cursor-pointer"
              onClick={onDeleteGarminCredentials}
            >
              <Settings className="mr-2 h-4 w-4" />
              <span>Remove Garmin Connection</span>
            </ContextMenuItem>
          </ContextMenuGroup>
        </ContextMenuContent>
      </ContextMenu>
      <Button onClick={handleLogout} variant="outline">
        Logout
      </Button>
    </div>
  );
};