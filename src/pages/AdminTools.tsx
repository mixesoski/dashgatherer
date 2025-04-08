import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export default function AdminTools() {
  const [userId, setUserId] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Get the current user when component mounts
    const fetchCurrentUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        setCurrentUser(data.session.user);
        setUserId(data.session.user.id);
        fetchSubscriptions(data.session.user.id);
      }
    };
    
    fetchCurrentUser();
  }, []);

  const fetchSubscriptions = async (id: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', id);
      
      if (error) throw error;
      setSubscriptions(data || []);
      console.log('Fetched subscriptions:', data);
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch subscriptions'
      });
    } finally {
      setLoading(false);
    }
  };

  const createActiveSubscription = async () => {
    if (!userId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please enter a user ID'
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .upsert({
          user_id: userId,
          status: 'active',
          plan_id: 'athlete_monthly',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (error) throw error;
      
      toast({
        title: 'Success',
        description: 'Active subscription created/updated'
      });
      
      fetchSubscriptions(userId);
    } catch (error) {
      console.error('Error creating subscription:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create subscription'
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSubscriptionStatus = async (id: string, status: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
      
      if (error) throw error;
      
      toast({
        title: 'Success',
        description: `Subscription updated to ${status}`
      });
      
      fetchSubscriptions(userId);
    } catch (error) {
      console.error('Error updating subscription:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update subscription'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Subscription Admin Tools</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Current User</CardTitle>
        </CardHeader>
        <CardContent>
          {currentUser ? (
            <div>
              <p><strong>ID:</strong> {currentUser.id}</p>
              <p><strong>Email:</strong> {currentUser.email}</p>
            </div>
          ) : (
            <p>Not logged in</p>
          )}
        </CardContent>
      </Card>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Create/Update Subscription</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="userId">User ID</Label>
              <Input 
                id="userId" 
                value={userId} 
                onChange={(e) => setUserId(e.target.value)} 
                placeholder="Enter user ID"
              />
            </div>
            
            <div className="flex space-x-4">
              <Button onClick={() => fetchSubscriptions(userId)} disabled={loading}>
                Fetch Subscriptions
              </Button>
              
              <Button onClick={createActiveSubscription} disabled={loading}>
                Create Active Subscription
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {subscriptions.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {subscriptions.map((sub) => (
                <div key={sub.id} className="border p-4 rounded-lg">
                  <p><strong>ID:</strong> {sub.id}</p>
                  <p><strong>User ID:</strong> {sub.user_id}</p>
                  <p><strong>Status:</strong> {sub.status}</p>
                  <p><strong>Plan:</strong> {sub.plan_id}</p>
                  <p><strong>Created:</strong> {new Date(sub.created_at).toLocaleString()}</p>
                  <p><strong>Updated:</strong> {new Date(sub.updated_at).toLocaleString()}</p>
                  
                  <div className="mt-4 flex space-x-2">
                    <Button 
                      onClick={() => updateSubscriptionStatus(sub.id, 'active')}
                      disabled={sub.status === 'active' || loading}
                      variant="default"
                    >
                      Set Active
                    </Button>
                    <Button 
                      onClick={() => updateSubscriptionStatus(sub.id, 'inactive')}
                      disabled={sub.status === 'inactive' || loading}
                      variant="outline"
                    >
                      Set Inactive
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <p>No subscriptions found</p>
      )}
    </div>
  );
} 