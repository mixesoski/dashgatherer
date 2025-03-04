
import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PricingTier } from "@/components/PricingTier";
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Check, X, HelpCircle } from "lucide-react";
import { Logo } from "@/components/Logo";

const PricingPage = () => {
  const features = [
    { 
      name: "Garmin Integration", 
      trial: "Limited", 
      coach: "View Only", 
      athlete: "Full", 
      organization: "Full" 
    },
    { 
      name: "Training Load Analytics", 
      trial: "Basic", 
      coach: "View Only", 
      athlete: "Advanced", 
      organization: "Advanced" 
    },
    { 
      name: "Data History", 
      trial: "7 days", 
      coach: "Athlete dependent", 
      athlete: "Unlimited", 
      organization: "Unlimited" 
    },
    { 
      name: "Coach Sharing", 
      trial: "Limited", 
      coach: "N/A", 
      athlete: "Full", 
      organization: "Full" 
    },
    { 
      name: "Multiple Athletes Management", 
      trial: false, 
      coach: "Limited", 
      athlete: false, 
      organization: "Unlimited" 
    },
    { 
      name: "Team Analytics", 
      trial: false, 
      coach: "Basic", 
      athlete: false, 
      organization: "Advanced" 
    },
    { 
      name: "Email Support", 
      trial: "Basic", 
      coach: "Basic", 
      athlete: "Priority", 
      organization: "Premium" 
    },
    { 
      name: "Custom Features", 
      trial: false, 
      coach: false, 
      athlete: false, 
      organization: true 
    },
    { 
      name: "API Access", 
      trial: false, 
      coach: false, 
      athlete: "Limited", 
      organization: "Full" 
    },
    { 
      name: "Dedicated Account Manager", 
      trial: false, 
      coach: false, 
      athlete: false, 
      organization: true 
    },
  ];

  const renderFeatureStatus = (value: string | boolean) => {
    if (value === true) {
      return <Check className="mx-auto text-green-500" size={20} />;
    } else if (value === false) {
      return <X className="mx-auto text-red-500" size={20} />;
    } else {
      return <span className="text-sm">{value}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Navigation */}
      <nav className="container mx-auto px-4 py-6 flex justify-between items-center">
        <Logo variant="light" />
        <div className="space-x-4">
          <Link to="/login">
            <Button variant="ghost" className="text-white hover:text-white hover:bg-white/10">
              Sign in
            </Button>
          </Link>
          <Link to="/login">
            <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
              Get Started
            </Button>
          </Link>
        </div>
      </nav>

      {/* Pricing Header */}
      <section className="container mx-auto px-4 pt-16 pb-12">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold">Choose Your Plan</h1>
          <p className="text-xl text-gray-400">
            Select the perfect plan for your training needs
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
          <PricingTier
            title="Trial"
            price="Free"
            description="Try before you commit"
            priceDescription="14 days"
            features={[
              "Limited Garmin integration",
              "Basic TRIMP analytics",
              "7-day data history",
              "Email support"
            ]}
            buttonText="Start Trial"
            buttonVariant="outline"
            buttonHref="/login"
            customCardStyle="bg-gradient-to-br from-blue-500/10 to-blue-600/10 backdrop-blur-xl border border-blue-500/20"
          />
          
          <PricingTier
            title="Coach"
            price="Free"
            description="For coaches who want to monitor their athletes"
            priceDescription="Always free"
            features={[
              "View connected athletes' data",
              "Basic analytics",
              "Email support",
              "Limited dashboard access"
            ]}
            buttonText="Sign Up Free"
            buttonVariant="outline"
            buttonHref="/login"
            customCardStyle="bg-gradient-to-br from-green-500/10 to-green-600/10 backdrop-blur-xl border border-green-500/20"
          />
          
          <PricingTier
            title="Athlete"
            price="$6.99"
            priceDescription="per month"
            description="For serious athletes looking to optimize performance"
            features={[
              "Garmin integration",
              "Advanced TRIMP analytics",
              "Training load tracking",
              "Coach sharing capabilities",
              "Email support",
              "Full dashboard access"
            ]}
            buttonText="Get Started"
            highlighted={true}
            buttonHref="/login"
          />
          
          <PricingTier
            title="Organization"
            price={<>Contact Us</>}
            description="For teams, clubs and organizations"
            priceDescription="Custom pricing"
            features={[
              "Everything in Athlete plan",
              "Bulk athlete management",
              "Advanced team analytics",
              "Custom features",
              "Premium support",
              "Dedicated account manager"
            ]}
            buttonText="Contact Sales"
            buttonVariant="outline"
            buttonHref="/login"
            customCardStyle="bg-gradient-to-br from-purple-500/10 to-purple-600/10 backdrop-blur-xl border border-purple-500/20"
          />
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">Feature Comparison</h2>
          
          <div className="overflow-x-auto rounded-lg border border-white/10 bg-white/5 backdrop-blur-xl">
            <Table>
              <TableCaption>Detailed feature comparison between all plans</TableCaption>
              <TableHeader>
                <TableRow className="bg-black/30">
                  <TableHead className="w-[250px]">Feature</TableHead>
                  <TableHead className="text-center">Trial</TableHead>
                  <TableHead className="text-center">Coach</TableHead>
                  <TableHead className="text-center bg-gradient-to-r from-purple-500/20 to-pink-500/20">Athlete</TableHead>
                  <TableHead className="text-center">Organization</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {features.map((feature, index) => (
                  <TableRow key={index} className={index % 2 === 0 ? "bg-black/10" : ""}>
                    <TableCell className="font-medium">{feature.name}</TableCell>
                    <TableCell className="text-center">{renderFeatureStatus(feature.trial)}</TableCell>
                    <TableCell className="text-center">{renderFeatureStatus(feature.coach)}</TableCell>
                    <TableCell className="text-center bg-gradient-to-r from-purple-500/5 to-pink-500/5">{renderFeatureStatus(feature.athlete)}</TableCell>
                    <TableCell className="text-center">{renderFeatureStatus(feature.organization)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          <div className="mt-8 text-center">
            <p className="text-gray-400 flex items-center justify-center gap-2">
              <HelpCircle size={16} /> 
              Need help choosing the right plan? <Link to="/login" className="text-purple-400 hover:text-purple-300">Contact our team</Link>
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-12 text-center">Frequently Asked Questions</h2>
          
          <div className="space-y-8">
            <div className="p-6 rounded-lg bg-white/5 backdrop-blur-xl border border-white/10">
              <h3 className="text-xl font-bold mb-2">Can I switch plans later?</h3>
              <p className="text-gray-400">
                Yes, you can upgrade or downgrade your plan at any time. If you upgrade, the new features will be available immediately. If you downgrade, the changes will take effect at the end of your current billing cycle.
              </p>
            </div>
            
            <div className="p-6 rounded-lg bg-white/5 backdrop-blur-xl border border-white/10">
              <h3 className="text-xl font-bold mb-2">How does the trial work?</h3>
              <p className="text-gray-400">
                The 14-day trial gives you access to a limited set of features so you can experience the platform before committing to a paid subscription. No credit card is required to start a trial.
              </p>
            </div>
            
            <div className="p-6 rounded-lg bg-white/5 backdrop-blur-xl border border-white/10">
              <h3 className="text-xl font-bold mb-2">What payment methods do you accept?</h3>
              <p className="text-gray-400">
                We accept all major credit cards, including Visa, Mastercard, and American Express. Payment processing is securely handled through Stripe.
              </p>
            </div>
            
            <div className="p-6 rounded-lg bg-white/5 backdrop-blur-xl border border-white/10">
              <h3 className="text-xl font-bold mb-2">Can I cancel my subscription?</h3>
              <p className="text-gray-400">
                Yes, you can cancel your subscription at any time from your account settings. After cancellation, you'll continue to have access to your paid features until the end of your current billing period.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20 border-t border-white/10">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <h2 className="text-4xl font-bold">
            Ready to Optimize Your Training?
          </h2>
          <p className="text-xl text-gray-400">
            Join athletes who are already using Trimpbara to reach their peak performance.
          </p>
          <Link to="/login">
            <Button size="lg" className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
              Get Started Now
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 border-t border-white/10">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-400">© 2024 Trimpbara. All rights reserved.</p>
          <div className="flex space-x-4">
            <a href="#" className="text-gray-400 hover:text-white">Privacy Policy</a>
            <a href="#" className="text-gray-400 hover:text-white">Terms of Service</a>
            <a href="#" className="text-gray-400 hover:text-white">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PricingPage;
