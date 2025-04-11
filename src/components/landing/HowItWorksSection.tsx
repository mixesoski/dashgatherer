
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
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Trimpbara simplifies the process of tracking and optimizing your training load.
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          {steps.map((step, index) => (
            <div key={index} className="flex flex-col md:flex-row items-center mb-16 last:mb-0">
              <div className="w-full md:w-1/2 md:pr-8 mb-8 md:mb-0">
                <div className="bg-gray-100 p-4 rounded-lg inline-block mb-4">
                  <span className="text-xl font-bold text-purple-600">{step.number}</span>
                </div>
                <h3 className="text-2xl font-bold mb-4">{step.title}</h3>
                <p className="text-gray-700 mb-4">{step.description}</p>
                {index !== steps.length - 1 && (
                  <div className="hidden md:block">
                    <ArrowRight className="text-purple-500 ml-2" size={24} />
                  </div>
                )}
                {index !== steps.length - 1 && (
                  <div className="md:hidden flex justify-center">
                    <ArrowDown className="text-purple-500" size={24} />
                  </div>
                )}
              </div>
              <div className="w-full md:w-1/2">
                <img 
                  src={step.image} 
                  alt={step.title} 
                  className="rounded-lg shadow-md w-full h-64 object-cover"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
