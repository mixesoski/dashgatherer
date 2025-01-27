import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SmtpClient } from "https://deno.land/x/smtp/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  coachEmail: string;
  athleteId: string;
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
      status: 204,
    });
  }

  try {
    const body = await req.text();
    const { coachEmail, athleteId }: InviteRequest = JSON.parse(body);
    console.log("Processing invitation request:", { coachEmail, athleteId });
  
    // Validate request data
    if (!coachEmail || !athleteId) {
      console.error("Invalid request data:", { coachEmail, athleteId });
      throw new Error("Invalid request data");
    }
  
    // Get athlete details using Supabase client
    console.log("Fetching athlete details for athleteId:", athleteId);
    const { data: userData, error: userError } = await supabase
      .from('user_roles')
      .select('user_id, users:user_id(email)')
      .eq('user_id', athleteId)
      .single();
  
    if (userError || !userData?.users?.email) {
      console.error("Error fetching athlete details:", userError);
      throw new Error("Athlete not found");
    }
  
    const athleteEmail = userData.users.email;
    console.log("Athlete email:", athleteEmail);
  
    // Create invitation record
    console.log("Creating invitation record for coachEmail:", coachEmail);
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
      console.error("Error creating invitation:", inviteError);
      throw inviteError;
    }
  
    console.log("Invitation created:", invitation);
  
    // Generate accept/reject URLs
    const baseUrl = req.headers.get("origin") || "http://localhost:5173";
    const acceptUrl = `${baseUrl}/respond-invitation?id=${invitation.id}&action=accept`;
    const rejectUrl = `${baseUrl}/respond-invitation?id=${invitation.id}&action=reject`;
  
    console.log("Sending email with URLs:", { acceptUrl, rejectUrl });
  
    // Configure SMTP client
    const client = new SmtpClient();
    await client.connect({
      hostname: "smtp.your-email-provider.com",
      port: 587,
      tls: true,
      username: "your-email@example.com",
      password: "your-email-password",
    });
  
    // Send email using SMTP
    console.log("Sending email to:", coachEmail);
    await client.send({
      from: "onboarding@yourdomain.com",
      to: coachEmail,
      subject: "Coach Invitation Request",
      content: `
        <h1>You've Been Invited to Be a Coach</h1>
        <p>An athlete (${athleteEmail}) has invited you to be their coach.</p>
        <p>Please click one of the following links to respond:</p>
        <p>
          <a href="${acceptUrl}" style="display: inline-block; padding: 10px 20px; margin-right: 10px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">Accept Invitation</a>
          <a href="${rejectUrl}" style="display: inline-block; padding: 10px 20px; background-color: #f44336; color: white; text-decoration: none; border-radius: 5px;">Reject Invitation</a>
        </p>
      `,
    });
  
    console.log("Email sent successfully");
  
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in send-coach-invitation function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);