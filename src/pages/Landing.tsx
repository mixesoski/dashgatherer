import { Link } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import "@/styles/squares-background.css";
import { Logo } from "@/components/Logo";
import { PricingTier } from "@/components/PricingTier";
import { Menu, X } from "lucide-react";
import FooterSection from "@/components/pricing/FooterSection";

const Landing = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="relative min-h-screen bg-[#0A0A0A] text-white squares-background">
      <div className="relative z-10">
        {/* Navigation */}
        <nav className="container mx-auto px-4 py-6 flex justify-between items-center">
          <Logo variant="light" />
          
          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Button 
              variant="ghost" 
              className="text-white hover:text-white hover:bg-white/10 p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </Button>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex space-x-4">
            <Link to="/pricing">
              <Button variant="ghost" className="text-white hover:text-white hover:bg-white/10">
                Pricing
              </Button>
            </Link>
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
        
        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-black/90 backdrop-blur-sm absolute z-20 inset-0 p-6">
            <div className="flex flex-col gap-4 items-center mt-16">
              <Link to="/pricing" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" className="text-white hover:text-white hover:bg-white/10 w-full justify-center text-lg">
                  Pricing
                </Button>
              </Link>
              <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" className="text-white hover:text-white hover:bg-white/10 w-full justify-center text-lg">
                  Sign in
                </Button>
              </Link>
              <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 w-full justify-center text-lg">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Hero Section */}
        <section className="container mx-auto px-4 py-12 md:py-20">
          <div className="max-w-4xl mx-auto text-center space-y-6 md:space-y-8">
            <h1 className="text-4xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-pink-500">
              Track Your Training Load Like Never Before
            </h1>
            <p className="text-lg md:text-xl text-gray-400">
              Advanced analytics and insights for athletes who want to optimize their training and reach peak performance.
            </p>
            <div className="flex justify-center gap-4">
              <Link to="/login">
                <Button size="lg" className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                  Start Tracking Now
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="container mx-auto px-4 py-12 md:py-20">
          <div className="grid md:grid-cols-3 gap-6 md:gap-8">
            <div className="p-6 rounded-lg bg-white/5 backdrop-blur-xl border border-white/10">
              <h3 className="text-xl font-bold mb-4">Garmin Integration</h3>
              <p className="text-gray-400">
                Seamlessly sync your Garmin data and get instant insights into your training load.
              </p>
            </div>
            <div className="p-6 rounded-lg bg-white/5 backdrop-blur-xl border border-white/10">
              <h3 className="text-xl font-bold mb-4">Advanced Analytics</h3>
              <p className="text-gray-400">
                Track your Acute and Chronic Training Load with sophisticated TRIMP calculations.
              </p>
            </div>
            <div className="p-6 rounded-lg bg-white/5 backdrop-blur-xl border border-white/10">
              <h3 className="text-xl font-bold mb-4">Coach Integration</h3>
              <p className="text-gray-400">
                Share your training data with your coach and get personalized feedback.
              </p>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section className="container mx-auto px-4 py-12 md:py-20">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto">
              Choose the plan that fits your needs and start optimizing your training today.
            </p>
            <div className="mt-6">
              <Link to="/pricing">
                <Button variant="outline" className="border-purple-500 text-purple-500 hover:bg-purple-500/10">
                  View Detailed Pricing & Features
                </Button>
              </Link>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 max-w-7xl mx-auto">
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
              planId="athlete"
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
              planId="coach"
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
              planId="athlete"
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
              planId="organization"
              customCardStyle="bg-gradient-to-br from-purple-500/10 to-purple-600/10 backdrop-blur-xl border border-purple-500/20"
            />
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 py-12 md:py-20">
          <div className="max-w-3xl mx-auto text-center space-y-6 md:space-y-8">
            <h2 className="text-3xl md:text-4xl font-bold">
              Ready to Optimize Your Training?
            </h2>
            <p className="text-lg md:text-xl text-gray-400">
              Join athletes who are already using Trimpbara to reach their peak performance.
            </p>
            <Link to="/login">
              <Button size="lg" className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                Get Started Now
              </Button>
            </Link>
          </div>
        </section>

        {/* Replace the old footer with the FooterSection component */}
        <FooterSection />
      </div>
    </div>
  );
};

export default Landing;
