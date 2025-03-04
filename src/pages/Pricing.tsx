
import React from "react";
import NavBar from "@/components/pricing/NavBar";
import PricingHeader from "@/components/pricing/PricingHeader";
import PricingCards from "@/components/pricing/PricingCards";
import FeatureComparison from "@/components/pricing/FeatureComparison";
import FAQ from "@/components/pricing/FAQ";
import CTASection from "@/components/pricing/CTASection";
import FooterSection from "@/components/pricing/FooterSection";

const PricingPage = () => {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <NavBar />
      <PricingHeader />
      <PricingCards />
      <FeatureComparison />
      <FAQ />
      <CTASection />
      <FooterSection />
    </div>
  );
};

export default PricingPage;
