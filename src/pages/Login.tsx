import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Database } from "@/integrations/supabase/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Logo } from "@/components/Logo";
import { createCheckoutSession } from "@/services/stripe";
import { Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { getUserFriendlyErrorMessage } from "@/utils/errorMessages";

type UserRole = Database["public"]["Enums"]["user_role"];
const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planId = searchParams.get('plan') as 'athlete' | 'coach' | 'organization' | null;
  const isMobile = useIsMobile();
  
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"sign_in" | "sign_up">("sign_in");
  const [role, setRole] = useState<UserRole>(planId === 'coach' ? 'coach' : 'athlete');
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [isRedirectingToCheckout, setIsRedirectingToCheckout] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubscriptionRedirect = async (userId: string) => {
    if (!planId || isRedirectingToCheckout) return;
    
    try {
      setIsRedirectingToCheckout(true);
      setIsLoading(true);
      
      if (planId === 'coach') {
        navigate('/dashboard');
        return;
      }
      
      if (planId === 'organization') {
        toast({
          title: "Contact Sales",
          description: "Please contact our sales team for organization pricing."
        });
        navigate('/dashboard');
        return;
      }
      
      const baseUrl = window.location.origin;
      const successUrl = `${baseUrl}/dashboard?subscription=success&plan=${planId}`;
      const cancelUrl = `${baseUrl}/pricing?subscription=canceled`;
      
      console.log("Creating checkout session for:", planId, userId);
      const result = await createCheckoutSession(planId, successUrl, cancelUrl);
      
      if (result.contactSales) {
        toast({
          title: "Contact Sales",
          description: result.message || "Please contact our sales team for more information."
        });
        navigate('/dashboard');
      } else if (result.url) {
        console.log("Redirecting to checkout URL:", result.url);
        window.location.href = result.url;
      } else {
        console.error("No URL returned from checkout session");
        toast({
          title: "Checkout Error",
          description: "There was an error setting up the checkout. Please try again.",
          variant: "destructive"
        });
        navigate('/pricing');
      }
    } catch (error) {
      console.error("Error redirecting to subscription:", error);
      toast({
        title: "Subscription Error",
        description: "There was an error setting up your subscription. Please try again from the pricing page.",
        variant: "destructive"
      });
      navigate('/dashboard');
    } finally {
      setIsRedirectingToCheckout(false);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
        error: sessionError
      } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error("Session check error:", sessionError);
        setError(getUserFriendlyErrorMessage(sessionError));
        return;
      }
      
      if (session) {
        console.log("User is logged in, checking for plan parameter:", planId);
        if (planId) {
          await handleSubscriptionRedirect(session.user.id);
        } else {
          navigate("/dashboard");
        }
      }
    };
    
    checkSession();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state changed:", event);
      
      if (event === 'SIGNED_IN' && session) {
        console.log("User signed in, checking for plan parameter:", planId);
        if (planId) {
          await handleSubscriptionRedirect(session.user.id);
        } else {
          navigate("/dashboard");
        }
      }
      
      if (event === 'SIGNED_OUT') {
        setError(null);
      }
      
      if (event === 'TOKEN_REFRESHED') {
        console.log('Token refreshed successfully');
      }
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, [navigate, planId]);

  useEffect(() => {
    if (planId === 'coach') {
      setRole('coach');
    }
  }, [planId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const {
      name,
      value
    } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      if (view === "sign_up") {
        const {
          data,
          error: signUpError
        } = await supabase.auth.signUp({
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
          setError(getUserFriendlyErrorMessage(signUpError));
        } else {
          if (data.user) {
            try {
              const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                  user_id: data.user.id,
                  email: formData.email,
                  role: role,
                  updated_at: new Date().toISOString()
                });

              if (profileError) {
                console.error('Error creating profile:', profileError);
              }
            } catch (profileCreationError) {
              console.error('Exception creating profile:', profileCreationError);
            }
          }

          toast({
            title: "Success!",
            description: "Please check your email to confirm your account."
          });
          
          if (data.session) {
            console.log("User signed up and session created without email confirmation");
            if (planId) {
              await handleSubscriptionRedirect(data.user.id);
            }
          }
        }
      } else {
        const {
          data,
          error: signInError
        } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password
        });
        
        if (signInError) {
          console.error('Error logging in:', signInError);
          setError(getUserFriendlyErrorMessage(signInError));
        } else {
          toast({
            title: "Welcome back!",
            description: "Successfully logged in."
          });
          
          if (planId && data.session) {
            await handleSubscriptionRedirect(data.user.id);
          }
        }
      }
    } catch (error) {
      console.error("Authentication error:", error);
      setError(getUserFriendlyErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gradient-to-br from-pink-500 via-purple-500 to-yellow-500">
      <div className="w-full md:w-1/2 p-6 md:p-12 bg-white text-black">
        <div className="flex items-center mb-8">
          <Logo variant="dark" className="mr-4" />
        </div>
        
        <div className="max-w-md mx-auto md:mx-0">
          <h1 className="text-3xl md:text-4xl font-bold text-black mb-2">
            {view === "sign_in" ? "Hello again," : "Welcome,"}
          </h1>
          <p className="text-lg md:text-xl text-black mb-6 md:mb-8">
            {view === "sign_in" ? "Welcome back, you've been missed" : "Create your account"}
          </p>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isRedirectingToCheckout && (
            <Alert className="mb-4 bg-blue-50 border-blue-200">
              <AlertDescription>Setting up your subscription. Please wait...</AlertDescription>
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
                className="w-full bg-white text-black placeholder:text-gray-500 border-gray-300" 
              />
            </div>

            <div>
              <Input 
                type="password" 
                name="password" 
                placeholder="Password" 
                value={formData.password} 
                onChange={handleInputChange} 
                className="w-full bg-white text-black placeholder:text-gray-500 border-gray-300" 
              />
            </div>

            {view === "sign_up" && (
              <div>
                <Label htmlFor="role" className="text-black">I am:</Label>
                <Select value={role} onValueChange={(value: UserRole) => setRole(value)}>
                  <SelectTrigger className="w-full bg-white text-black border-gray-300">
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="athlete">Athlete</SelectItem>
                    <SelectItem value="coach">Coach</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full bg-black text-white hover:bg-gray-900" 
              disabled={isLoading || isRedirectingToCheckout}
            >
              {isLoading || isRedirectingToCheckout ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isLoading || isRedirectingToCheckout ? "Please wait..." : view === "sign_in" ? "Login" : "Sign up"}
            </Button>

            <div className="text-black text-sm">
              {view === "sign_in" ? (
                <p>
                  Don't have an account yet?{" "}
                  <button 
                    type="button" 
                    onClick={() => setView("sign_up")} 
                    className="text-black underline hover:text-gray-700"
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
                    className="text-black underline hover:text-gray-700"
                  >
                    Login
                  </button>
                </p>
              )}
            </div>
          </form>
        </div>
      </div>
      
      <div className="w-full md:w-1/2 p-6 flex items-center justify-center bg-gradient-to-br from-pink-500 via-purple-500 to-yellow-500">
        <h1 className="text-4xl md:text-6xl font-bold text-white">Trimpbara</h1>
      </div>
    </div>
  );
};

export default Login;
