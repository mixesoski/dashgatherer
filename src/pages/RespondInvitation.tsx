import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const RespondInvitation = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const handleInvitationResponse = async () => {
      try {
        const invitationId = searchParams.get("id");
        const action = searchParams.get("action");

        if (!invitationId || !action) {
          toast.error("Invalid invitation link");
          navigate("/dashboard");
          return;
        }

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          toast.error("Please log in to respond to the invitation");
          navigate("/login");
          return;
        }

        if (action === "accept") {
          // Update invitation status
          const { error: updateError } = await supabase
            .from("coach_invitations")
            .update({ status: "accepted" })
            .eq("id", invitationId);

          if (updateError) throw updateError;

          // Get the invitation details
          const { data: invitation, error: invitationError } = await supabase
            .from("coach_invitations")
            .select("athlete_id")
            .eq("id", invitationId)
            .single();

          if (invitationError) throw invitationError;

          // Create coach-athlete relationship
          const { error: relationError } = await supabase
            .from("coach_athletes")
            .insert({
              coach_id: user.id,
              athlete_id: invitation.athlete_id
            });

          if (relationError) throw relationError;

          toast.success("Invitation accepted successfully!");
        } else if (action === "reject") {
          const { error } = await supabase
            .from("coach_invitations")
            .update({ status: "rejected" })
            .eq("id", invitationId);

          if (error) throw error;
          toast.success("Invitation rejected");
        }

        navigate("/dashboard");
      } catch (error: any) {
        console.error("Error handling invitation:", error);
        toast.error(error.message || "Failed to process invitation");
        navigate("/dashboard");
      } finally {
        setIsProcessing(false);
      }
    };

    handleInvitationResponse();
  }, [searchParams, navigate]);

  if (isProcessing) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-4">Processing Invitation...</h1>
          <p className="text-gray-600">Please wait while we process your response.</p>
        </div>
      </div>
    );
  }

  return null;
};

export default RespondInvitation;