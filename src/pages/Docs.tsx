
import React from 'react';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { BookOpen, FileText, Search } from 'lucide-react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { useAuth } from '@supabase/auth-helpers-react';

const Docs = () => {
  const { user } = useAuth();
  const userEmail = user?.email;
  const userRole = 'athlete'; // This would be fetched from the user's profile

  const resources = [
    {
      title: "TRIMP Calculation Guide",
      description: "Learn how Training Impulse (TRIMP) is calculated from your heart rate data.",
      icon: <FileText className="h-8 w-8 text-blue-500" />,
      link: "#trimp-guide"
    },
    {
      title: "Understanding TSB",
      description: "Training Stress Balance (TSB) explained: monitoring your fatigue and fitness.",
      icon: <FileText className="h-8 w-8 text-green-500" />,
      link: "#tsb-guide"
    },
    {
      title: "Garmin Connect Setup",
      description: "Step-by-step instructions for connecting your Garmin account.",
      icon: <FileText className="h-8 w-8 text-orange-500" />,
      link: "#garmin-setup"
    }
  ];

  const faqs = [
    {
      question: "How is TRIMP calculated?",
      answer: "TRIMP (Training Impulse) is calculated using the formula: Duration × Average HR × Intensity Factor. The intensity factor is derived from the exponential relationship between heart rate and blood lactate levels."
    },
    {
      question: "What is the difference between ATL and CTL?",
      answer: "Acute Training Load (ATL) represents your short-term fatigue, typically over 7 days. Chronic Training Load (CTL) represents your longer-term fitness, typically over 42 days. The balance between these two metrics (TSB) indicates your form."
    },
    {
      question: "How often should I sync my Garmin data?",
      answer: "Trimpbara automatically syncs with Garmin Connect once daily. However, you can manually trigger a sync at any time from the dashboard to get the most up-to-date information."
    }
  ];

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar userRole={userRole} userEmail={userEmail} />
      
      <main className="flex-1 p-6 md:p-8 md:pt-10">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-3xl font-bold tracking-tight">Documentation</h1>
          <p className="text-muted-foreground mt-2 mb-6">
            Learn how to get the most out of Trimpbara for your training analysis
          </p>

          <Tabs defaultValue="guides" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="guides">
                <BookOpen className="mr-2 h-4 w-4" />
                Guides
              </TabsTrigger>
              <TabsTrigger value="faqs">
                <Search className="mr-2 h-4 w-4" />
                FAQs
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="guides">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
                {resources.map((resource, index) => (
                  <Card key={index} className="transition-all hover:shadow-md">
                    <CardHeader className="pb-2">
                      <div className="mb-2">{resource.icon}</div>
                      <CardTitle className="text-xl">{resource.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="mb-4">{resource.description}</CardDescription>
                      <a 
                        href={resource.link} 
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        Read more →
                      </a>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              <Card>
                <CardHeader>
                  <CardTitle>Training Metrics Guide</CardTitle>
                  <CardDescription>Understanding the key metrics used in Trimpbara</CardDescription>
                </CardHeader>
                <CardContent className="prose max-w-none">
                  <h3 id="trimp-guide">Training Impulse (TRIMP)</h3>
                  <p>
                    TRIMP is a method to quantify training load based on heart rate data. It takes into account both 
                    the intensity and duration of your training sessions, providing a single numerical value that 
                    represents the overall training stress.
                  </p>
                  
                  <h3 id="tsb-guide">Training Stress Balance (TSB)</h3>
                  <p>
                    TSB represents the balance between your fitness (Chronic Training Load) and fatigue 
                    (Acute Training Load). A positive TSB indicates that you're well-recovered and potentially 
                    in good form, while a negative TSB suggests accumulated fatigue that may require recovery.
                  </p>
                  
                  <h3 id="garmin-setup">Connecting to Garmin Connect</h3>
                  <p>
                    To connect your Garmin account, navigate to the Account settings page and enter your Garmin 
                    Connect credentials in the designated section. Trimpbara will then automatically sync your 
                    activities and calculate the relevant training metrics.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="faqs">
              <Card>
                <CardHeader>
                  <CardTitle>Frequently Asked Questions</CardTitle>
                  <CardDescription>Common questions about Trimpbara and training metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {faqs.map((faq, index) => (
                      <div key={index} className="border-b border-gray-200 pb-4 last:border-0 last:pb-0">
                        <h3 className="font-medium text-lg mb-2">{faq.question}</h3>
                        <p className="text-muted-foreground">{faq.answer}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Docs;
