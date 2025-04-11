import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Logo } from "@/components/Logo";
import { Home } from "lucide-react";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
const formSchema = z.object({
  email: z.string().email("Invalid email address"),
  nickname: z.string().optional().or(z.literal("")),
  garmin_email: z.string().email("Invalid Garmin email").optional().or(z.literal("")),
  garmin_password: z.string().min(1, "Password is required").optional().or(z.literal(""))
});
const Account = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      nickname: "",
      garmin_email: "",
      garmin_password: ""
    }
  });
  useEffect(() => {
    const getProfile = async () => {
      try {
        const {
          data: {
            user
          }
        } = await supabase.auth.getUser();
        if (!user) {
          navigate("/login");
          return;
        }
        setUserId(user.id);
        const {
          data: profile,
          error
        } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
        if (error) throw error;
        if (profile) {
          setProfile(profile);
          setUserRole(profile.role);
          setUserEmail(profile.email);
          form.reset({
            email: profile.email || "",
            nickname: profile.nickname || "",
            garmin_email: profile.garmin_email || "",
            garmin_password: "" // Don't show the actual password
          });
        }
      } catch (error: any) {
        toast.error(error.message || "Error loading profile");
      } finally {
        setLoading(false);
      }
    };
    getProfile();
  }, [navigate, form]);
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");
      const updates = {
        user_id: user.id,
        email: values.email,
        nickname: values.nickname,
        garmin_email: values.garmin_email,
        updated_at: new Date().toISOString()
      };

      // If a new Garmin password is provided, update it
      if (values.garmin_password) {
        const {
          error: garminError
        } = await supabase.rpc('update_garmin_credentials_both', {
          p_user_id: user.id,
          p_garmin_email: values.garmin_email,
          p_garmin_password: values.garmin_password
        });
        if (garminError) throw garminError;
      }
      const {
        error
      } = await supabase.from("profiles").update(updates).eq("user_id", user.id);
      if (error) throw error;
      toast.success("Profile updated successfully");
      setProfile({
        ...profile,
        ...updates
      });
    } catch (error: any) {
      toast.error(error.message || "Error updating profile");
    }
  };
  const handleDeleteGarminCredentials = async () => {
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to delete your credentials');
        return;
      }

      // Update profiles table to clear Garmin credentials
      const {
        error: profilesError
      } = await supabase.from('profiles').update({
        garmin_email: null,
        garmin_password: null
      }).eq('user_id', user.id);
      if (profilesError) {
        console.error('Error updating profiles:', profilesError);
        toast.error('Failed to delete Garmin credentials from profiles');
        return;
      }

      // Delete from garmin_credentials table if it exists
      const {
        error: garminError
      } = await supabase.from('garmin_credentials').delete().eq('user_id', user.id);
      if (garminError && !garminError.message.includes('does not exist')) {
        console.error('Error deleting from garmin_credentials:', garminError);
        toast.error('Failed to delete Garmin credentials');
        return;
      }
      toast.success('Garmin credentials deleted successfully');

      // Update the form and local state
      form.setValue('garmin_email', '');
      form.setValue('garmin_password', '');
      setProfile({
        ...profile,
        garmin_email: null,
        garmin_password: null
      });
    } catch (error) {
      console.error('Error:', error);
      toast.error('An unexpected error occurred');
    }
  };
  const handleDeleteAllData = async () => {
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to delete your data');
        return;
      }
      const {
        error
      } = await supabase.from('garmin_data').delete().eq('user_id', user.id);
      if (error) {
        console.error('Error deleting data:', error);
        toast.error('Failed to delete data');
        return;
      }
      toast.success('All your data has been deleted');
    } catch (error) {
      console.error('Error:', error);
      toast.error('An unexpected error occurred');
    }
  };
  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }
  return <div className="flex h-screen bg-gray-50 overflow-hidden">
      <DashboardSidebar userRole={userRole} userEmail={userEmail} />
      
      
    </div>;
};
export default Account;