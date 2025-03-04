
import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const CTASection = () => {
  return (
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
  );
};

export default CTASection;
