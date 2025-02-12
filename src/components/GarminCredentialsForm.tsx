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
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        toast.error("You must be logged in to save Garmin credentials")
        return
      }

      const { error } = await supabase
        .from('garmin_credentials')
        .upsert({ 
          user_id: user.id,
          email: values.email,
          password: values.password
        })

      if (error) {
        console.error('Error saving to garmin_credentials:', error)
        throw error
      }

      // Update profiles table with garmin_email and garmin_password using upsert
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ 
          user_id: user.id,
          garmin_email: values.email,
          garmin_password: values.password
        }, { onConflict: 'user_id' })

      if (profileError) {
        console.error('Error saving to profiles:', profileError)
        throw profileError
      }

      toast.success("Garmin credentials saved successfully!")
      form.reset()
      refetch() // Refresh the credentials data
    } catch (error: any) {
      console.error('Full error details:', error)
      toast.error(error.message || "Failed to save Garmin credentials")
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