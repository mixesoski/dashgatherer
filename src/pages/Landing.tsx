
import { Link } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { Menu, X } from "lucide-react";
import { PricingTier } from "@/components/PricingTier";
import FooterSection from "@/components/landing/FooterSection";
import HeroSection from "@/components/landing/HeroSection";
import FeatureCarousel from "@/components/landing/FeatureCarousel";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import IntegrationSection from "@/components/landing/IntegrationSection";
import CallToAction from "@/components/landing/CallToAction";

const Landing = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Navigation */}
      <nav className="absolute top-0 left-0 right-0 z-50 container mx-auto px-4 py-6 flex justify-between items-center">
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
        <div className="hidden md:flex space-x-4 items-center">
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
            <Button className="bg-white text-purple-900 hover:bg-gray-100">
              Get Started
            </Button>
          </Link>
        </div>
      </nav>
      
      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-purple-900 text-white absolute z-20 inset-0 p-6">
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
              <Button className="bg-white text-purple-900 hover:bg-gray-100 w-full justify-center text-lg">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Main Content Sections */}
      <HeroSection />
      <FeatureCarousel />
      <HowItWorksSection />
      <IntegrationSection />
      <TestimonialsSection />
      
      {/* Pricing Section */}
      <section className="container mx-auto px-4 py-20 bg-gray-50">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
          <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto">
            Choose the plan that fits your needs and start optimizing your training today.
          </p>
          <div className="mt-6">
            <Link to="/pricing">
              <Button variant="outline" className="border-purple-500 text-purple-500 hover:bg-purple-50">
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
            customCardStyle="bg-white shadow-lg border border-gray-200"
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
            customCardStyle="bg-white shadow-lg border border-gray-200"
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
            customCardStyle="bg-white shadow-lg border border-gray-200"
          />
        </div>
      </section>

      {/* Call to Action */}
      <CallToAction />

      {/* Footer */}
      <FooterSection />
    </div>
  );
};

export default Landing;
