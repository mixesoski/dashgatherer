"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { useState, useEffect } from "react"
import { RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/integrations/supabase/client"
import { useQuery } from "@tanstack/react-query"

const formSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
})

export function GarminCredentialsForm() {
  const navigate = useNavigate()
  const [hasCredentials, setHasCredentials] = useState(false)

  const { data: garminCredentials, refetch } = useQuery({
    queryKey: ['garminCredentials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('garmin_credentials')
        .select('*')
        .maybeSingle()

      if (error) throw error
      return data
    }
  })

  useEffect(() => {
    setHasCredentials(!!garminCredentials)
  }, [garminCredentials])

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        toast.error("You must be logged in to connect your Garmin account");
        return;
      }
    
      const { error } = await supabase.rpc('update_garmin_credentials_both', {
        p_user_id: user.id,
        p_garmin_email: values.email,
        p_garmin_password: values.password,
      });
    
      if (error) throw error;
    
      toast.success("Garmin credentials saved securely!");
      form.reset();
      refetch(); // if needed
    } catch (error) {
      console.error("Error saving Garmin credentials:", error);
      toast.error("Failed to save Garmin credentials securely");
    }
  }

  if (hasCredentials) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Garmin Account Connected</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">Your Garmin account ({garminCredentials?.email}) is connected.</p>
          <Button 
            variant="outline" 
            className="w-full flex items-center justify-center gap-2"
            onClick={() => navigate('/')}
          >
            <RefreshCw className="h-4 w-4" />
            Go to Sync Page
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Connect Garmin Account</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Garmin Email</FormLabel>
                  <FormControl>
                    <Input 
                      type="email"
                      placeholder="Enter your Garmin email" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Garmin Password</FormLabel>
                  <FormControl>
                    <Input 
                      type="password" 
                      placeholder="Enter your Garmin password" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full">
              Save Credentials
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}