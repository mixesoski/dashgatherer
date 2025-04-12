
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
    <section className="bg-gray-50 py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Our simple 4-step process helps you optimize your training with powerful analytics
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
          {steps.map((step, index) => (
            <div key={step.number} className="relative">
              <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="h-48 overflow-hidden">
                  <img 
                    src={step.image} 
                    alt={`Step ${step.number}`} 
                    className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
                  />
                </div>
                <div className="p-6">
                  <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold mb-4">
                    {step.number}
                  </div>
                  <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                  <p className="text-gray-600">{step.description}</p>
                </div>
              </div>
              
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-4 transform -translate-y-1/2 z-10">
                  <ArrowRight className="text-purple-400" size={24} />
                </div>
              )}
              
              {index < steps.length - 1 && (
                <div className="lg:hidden absolute -bottom-4 left-1/2 transform -translate-x-1/2 z-10">
                  <ArrowDown className="text-purple-400" size={24} />
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
