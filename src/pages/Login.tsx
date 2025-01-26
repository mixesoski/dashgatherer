import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const Login = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"sign_in" | "sign_up">("sign_in");
  const [role, setRole] = useState<"athlete" | "coach">("athlete");
  const [isRegistering, setIsRegistering] = useState(false);
  const [roles, setRoles] = useState([]);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: ''
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
        navigate("/");
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        navigate("/");
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

  useEffect(() => {
    // Fetch roles from user_roles table
    const fetchRoles = async () => {
      const { data, error } = await supabase.from('user_roles').select('role');
      if (error) console.error('Error fetching roles:', error);
      else setRoles(data);
    };
    fetchRoles();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isRegistering) {
      // Registration logic
      const { user, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password
      });
      if (error) console.error('Error signing up:', error);
      else {
        // Assign role to new user
        await supabase.from('user_roles').insert([{ user_id: user.id, role: formData.role }]);
        console.log('User registered and role assigned:', user);
      }
    } else {
      // Login logic
      const { error } = await supabase.auth.signIn({
        email: formData.email,
        password: formData.password
      });
      if (error) console.error('Error logging in:', error);
      else console.log('User logged in');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold text-center mb-6">
          {view === "sign_in" ? "Zaloguj się" : "Zarejestruj się"}
        </h2>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {view === "sign_up" && (
          <div className="mb-6">
            <Label htmlFor="role">Jestem:</Label>
            <Select value={role} onValueChange={(value: "athlete" | "coach") => setRole(value)}>
              <SelectTrigger className="w-full mt-2">
                <SelectValue placeholder="Wybierz swoją rolę" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="athlete">Zawodnikiem</SelectItem>
                <SelectItem value="coach">Trenerem</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <Auth
          supabaseClient={supabase}
          view={view}
          appearance={{ 
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: 'rgb(59 130 246)',
                  brandAccent: 'rgb(37 99 235)',
                }
              }
            }
          }}
          localization={{
            variables: {
              sign_in: {
                email_label: "Email",
                password_label: "Hasło",
                button_label: "Zaloguj się",
                email_input_placeholder: "Twój adres email",
                password_input_placeholder: "Twoje hasło",
                link_text: "Nie masz konta? Zarejestruj się",
                loading_button_label: "Logowanie..."
              },
              sign_up: {
                email_label: "Email",
                password_label: "Hasło",
                button_label: "Zarejestruj się",
                email_input_placeholder: "Twój adres email",
                password_input_placeholder: "Twoje hasło",
                link_text: "Masz już konto? Zaloguj się",
                loading_button_label: "Rejestracja..."
              }
            }
          }}
          providers={[]}
          additionalData={{
            role: role
          }}
        />
      </div>
    </div>
  );
};

export default Login;