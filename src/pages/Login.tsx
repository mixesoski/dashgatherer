import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

const Login = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check for existing session on mount
    const checkSession = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("Session check error:", sessionError);
          setError(sessionError.message);
          return;
        }
        
        if (session) {
          navigate("/");
        }
      } catch (err) {
        console.error("Session check failed:", err);
        toast.error("Failed to check authentication status");
      }
    };

    checkSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth event:", event);
      
      if (event === 'SIGNED_IN' && session) {
        navigate("/");
      }
      if (event === 'SIGNED_OUT') {
        setError(null);
      }
      if (event === 'TOKEN_REFRESHED') {
        console.log('Token refreshed successfully');
      }
      if (event === 'USER_UPDATED') {
        console.log('User updated');
      }
    });

    // Cleanup subscription
    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold text-center mb-6">Welcome Back</h2>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Auth
          supabaseClient={supabase}
          appearance={{ 
            theme: ThemeSupa,
            style: {
              button: { background: 'rgb(59 130 246)', color: 'white' },
              anchor: { color: 'rgb(59 130 246)' },
            }
          }}
          providers={[]}
          redirectTo={window.location.origin + '/login'}
          theme="light"
        />
      </div>
    </div>
  );
};

export default Login;