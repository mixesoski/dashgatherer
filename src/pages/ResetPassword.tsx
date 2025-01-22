import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Get the access token from the URL
  useEffect(() => {
    const setupSession = async () => {
      const accessToken = searchParams.get("access_token");
      if (!accessToken) {
        setError("Invalid or missing reset token. Please request a new password reset link.");
        return;
      }

      // Set the session with the access token
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: "",
      });

      if (sessionError) {
        console.error("Session error:", sessionError);
        setError("Invalid or expired reset token. Please request a new password reset link.");
      }
    };

    setupSession();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({ 
        password: password 
      });

      if (updateError) {
        console.error("Update error:", updateError);
        setError(updateError.message);
        return;
      }

      toast.success("Password updated successfully!");
      // Sign out the user after password reset
      await supabase.auth.signOut();
      navigate("/login");
    } catch (err) {
      console.error("Error updating password:", err);
      setError("An error occurred while updating your password.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold text-center mb-6">Reset Password</h2>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              New Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1"
              placeholder="Enter your new password"
              required
              minLength={6}
            />
          </div>
          <Button type="submit" className="w-full">
            Update Password
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;