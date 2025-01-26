import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Database } from "@/integrations/supabase/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type UserRole = Database["public"]["Enums"]["user_role"];

const Login = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"sign_in" | "sign_up">("sign_in");
  const [role, setRole] = useState<UserRole>("athlete");
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error("Session check error:", sessionError);
        setError("Nieprawidłowe dane logowania");
        return;
      }
      if (session) {
        navigate("/dashboard");
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        navigate("/dashboard");
      }
      if (event === 'SIGNED_OUT') {
        setError(null);
      }
      if (event === 'TOKEN_REFRESHED') {
        console.log('Token odświeżony pomyślnie');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (view === "sign_up") {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            role: role
          }
        }
      });

      if (signUpError) {
        console.error('Error signing up:', signUpError);
        setError(signUpError.message);
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password
      });

      if (signInError) {
        console.error('Error logging in:', signInError);
        setError(signInError.message);
      }
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-pink-500 via-purple-500 to-yellow-500">
      <div className="w-1/2 p-12">
        <Link to="/" className="text-white hover:text-gray-200 inline-flex items-center mb-8">
          <span className="mr-2">←</span> Go back home
        </Link>
        
        <div className="max-w-md">
          <h1 className="text-4xl font-bold text-white mb-2">
            {view === "sign_in" ? "Hello again," : "Welcome,"}
          </h1>
          <p className="text-xl text-white mb-8">
            {view === "sign_in" ? "Welcome back, you've been missed" : "Create your account"}
          </p>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                type="email"
                name="email"
                placeholder="Email address"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full bg-white/10 text-white placeholder:text-white/60 border-white/20"
              />
            </div>

            <div>
              <Input
                type="password"
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleInputChange}
                className="w-full bg-white/10 text-white placeholder:text-white/60 border-white/20"
              />
            </div>

            {view === "sign_up" && (
              <div>
                <Label htmlFor="role" className="text-white">I am:</Label>
                <Select value={role} onValueChange={(value: UserRole) => setRole(value)}>
                  <SelectTrigger className="w-full bg-white/10 text-white border-white/20">
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="athlete">Athlete</SelectItem>
                    <SelectItem value="coach">Coach</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button type="submit" className="w-full bg-black text-white hover:bg-gray-900">
              {view === "sign_in" ? "Login" : "Sign up"}
            </Button>

            <div className="text-white text-sm">
              {view === "sign_in" ? (
                <p>
                  Don't have an account yet?{" "}
                  <button
                    type="button"
                    onClick={() => setView("sign_up")}
                    className="text-white underline hover:text-gray-200"
                  >
                    Sign up
                  </button>
                </p>
              ) : (
                <p>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setView("sign_in")}
                    className="text-white underline hover:text-gray-200"
                  >
                    Login
                  </button>
                </p>
              )}
            </div>
          </form>
        </div>
      </div>
      <div className="w-1/2 flex items-center justify-center">
        <h1 className="text-6xl font-bold text-white">Floxfly</h1>
      </div>
    </div>
  );
};

export default Login;