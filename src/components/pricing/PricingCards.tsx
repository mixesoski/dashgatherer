
import React from "react";
import { PricingTier } from "@/components/PricingTier";

const PricingCards = () => {
  return (
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
          planId="athlete" // Using athlete plan with trial settings
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
  );
};

export default PricingCards;
