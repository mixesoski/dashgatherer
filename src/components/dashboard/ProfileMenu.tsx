
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
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { CreditCard, User, LogOut } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";

interface ProfileMenuProps {
  onDeleteGarminCredentials: () => void;
}

export const ProfileMenu = ({ onDeleteGarminCredentials }: ProfileMenuProps) => {
  const navigate = useNavigate();
  const { subscription } = useSubscription();

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Error signing out");
      return;
    }
    navigate("/login");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Menu</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <Link to="/account" className="block w-full">
          <DropdownMenuLabel className="cursor-pointer hover:bg-accent hover:text-accent-foreground flex items-center gap-2">
            <User className="h-4 w-4" />
            My Account
          </DropdownMenuLabel>
        </Link>
        
        <Link to="/subscription" className="block w-full">
          <DropdownMenuLabel className="cursor-pointer hover:bg-accent hover:text-accent-foreground flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            {subscription?.active ? "Manage Subscription" : "Get Premium"}
          </DropdownMenuLabel>
        </Link>
        
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer flex items-center gap-2">
          <LogOut className="h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
