
import React from "react";

const FAQ = () => {
  return (
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
  );
};

export default FAQ;
