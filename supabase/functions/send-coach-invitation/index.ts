import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  coachEmail: string;
  athleteId: string;
}

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { coachEmail, athleteId }: InviteRequest = await req.json();

    // Get athlete details
    const { data: athlete } = await supabase
      .from("auth")
      .select("email")
      .eq("id", athleteId)
      .single();

    if (!athlete) {
      throw new Error("Athlete not found");
    }

    // Create invitation record
    const { data: invitation, error: inviteError } = await supabase
      .from("coach_invitations")
      .insert({
        athlete_id: athleteId,
        coach_email: coachEmail,
        status: "pending",
      })
      .select()
      .single();

    if (inviteError) {
      throw inviteError;
    }

    // Generate accept/reject URLs
    const baseUrl = req.headers.get("origin") || "http://localhost:5173";
    const acceptUrl = `${baseUrl}/respond-invitation?id=${invitation.id}&action=accept`;
    const rejectUrl = `${baseUrl}/respond-invitation?id=${invitation.id}&action=reject`;

    // Send email
    const emailResponse = await resend.emails.send({
      from: "Lovable <onboarding@resend.dev>",
      to: [coachEmail],
      subject: "Coach Invitation Request",
      html: `
        <h1>You've Been Invited to Be a Coach</h1>
        <p>An athlete (${athlete.email}) has invited you to be their coach.</p>
        <p>Please click one of the following links to respond:</p>
        <p>
          <a href="${acceptUrl}" style="display: inline-block; padding: 10px 20px; margin-right: 10px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">Accept Invitation</a>
          <a href="${rejectUrl}" style="display: inline-block; padding: 10px 20px; background-color: #f44336; color: white; text-decoration: none; border-radius: 5px;">Reject Invitation</a>
        </p>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in send-coach-invitation function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);