import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const InviteCoachDialog = () => {
  const [email, setEmail] = useState("");

  const handleInvite = () => {
    // TODO: Implement coach invitation logic
    toast.success("Invitation sent to " + email);
    setEmail("");
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <UserPlus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Invite Coach</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex items-center gap-4">
            <Input
              placeholder="Coach's email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button onClick={handleInvite}>Invite</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};