
import { ArrowDown, ArrowRight } from "lucide-react";

const HowItWorksSection = () => {
  const steps = [{
    number: "01",
    title: "Connect Your Garmin Account",
    description: "Seamlessly integrate with your Garmin device to automatically sync your workout data.",
    image: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&q=80&w=800"
  }, {
    number: "02",
    title: "Track Your Training Load",
    description: "Monitor your Acute and Chronic Training Load with sophisticated TRIMP calculations.",
    image: "https://images.unsplash.com/photo-1487058792275-0ad4aaf24ca7?auto=format&fit=crop&q=80&w=800"
  }, {
    number: "03",
    title: "Analyze Performance Trends",
    description: "Gain insights through comprehensive analytics and visualizations of your training data.",
    image: "https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&q=80&w=800"
  }, {
    number: "04",
    title: "Optimize Your Training",
    description: "Use the insights to adjust your training schedule and improve performance.",
    image: "https://images.unsplash.com/photo-1649972904349-6e44c42644a7?auto=format&fit=crop&q=80&w=800"
  }];

  return (
    <section className="py-24 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Our platform makes it easy to track and optimize your training with just a few simple steps.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
          {steps.map((step, index) => (
            <div key={index} className="flex flex-col">
              <div className="relative mb-6 overflow-hidden rounded-xl">
                <img 
                  src={step.image} 
                  alt={step.title} 
                  className="w-full h-64 object-cover transition-transform duration-500 hover:scale-105"
                />
                <div className="absolute top-4 left-4 bg-purple-600 text-white text-xl font-bold w-12 h-12 rounded-full flex items-center justify-center">
                  {step.number}
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
              <p className="text-gray-600 mb-4">{step.description}</p>
              
              {index < steps.length - 1 ? (
                <div className="hidden lg:flex justify-center mt-auto">
                  <ArrowRight className="text-purple-500 h-6 w-6" />
                </div>
              ) : (
                <div className="hidden lg:flex justify-center mt-auto">
                  <div className="w-6 h-6" /> {/* Empty spacer */}
                </div>
              )}
              
              {index < steps.length - 1 && (
                <div className="flex lg:hidden justify-center mt-auto">
                  <ArrowDown className="text-purple-500 h-6 w-6" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
