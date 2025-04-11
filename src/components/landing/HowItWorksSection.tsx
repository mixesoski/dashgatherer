
import { ArrowDown, ArrowRight } from "lucide-react";

const HowItWorksSection = () => {
  const steps = [
    {
      number: "01",
      title: "Connect Your Garmin Account",
      description: "Seamlessly integrate with your Garmin device to automatically sync your workout data.",
      image: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&q=80&w=800"
    },
    {
      number: "02",
      title: "Track Your Training Load",
      description: "Monitor your Acute and Chronic Training Load with sophisticated TRIMP calculations.",
      image: "https://images.unsplash.com/photo-1487058792275-0ad4aaf24ca7?auto=format&fit=crop&q=80&w=800"
    },
    {
      number: "03",
      title: "Analyze Performance Trends",
      description: "Gain insights through comprehensive analytics and visualizations of your training data.",
      image: "https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&q=80&w=800"
    },
    {
      number: "04",
      title: "Optimize Your Training",
      description: "Use the insights to adjust your training schedule and improve performance.",
      image: "https://images.unsplash.com/photo-1649972904349-6e44c42644a7?auto=format&fit=crop&q=80&w=800"
    }
  ];

  return (
    <section className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">How Trimpbara Works</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Our simple process helps you get the most out of your training data.
          </p>
        </div>

        <div className="relative max-w-4xl mx-auto">
          {/* Vertical line connecting steps */}
          <div className="absolute left-1/2 transform -translate-x-1/2 top-0 bottom-0 w-0.5 bg-gray-200 hidden md:block"></div>
          
          {steps.map((step, index) => (
            <div key={index} className="relative mb-16 last:mb-0">
              <div className={`flex flex-col md:flex-row items-center ${index % 2 === 0 ? '' : 'md:flex-row-reverse'}`}>
                <div className="md:w-1/2 mb-6 md:mb-0 md:px-8">
                  <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100">
                    <div className="text-xs font-semibold text-purple-600 mb-2">STEP {step.number}</div>
                    <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                    <p className="text-gray-600">{step.description}</p>
                  </div>
                </div>
                
                <div className="md:w-1/2 flex justify-center">
                  {/* Circle marker on the timeline */}
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-purple-100 border-4 border-white shadow flex items-center justify-center z-10 relative">
                      <span className="text-purple-600 font-bold">{step.number}</span>
                    </div>
                    
                    {/* Arrow to next step (except last step) */}
                    {index < steps.length - 1 && (
                      <div className="absolute top-14 left-1/2 transform -translate-x-1/2 hidden md:block">
                        <ArrowDown className="text-purple-400 w-6 h-6" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Step image/illustration */}
              <div className="mt-8 rounded-lg overflow-hidden md:w-1/3 mx-auto">
                <img 
                  src={step.image} 
                  alt={`Step ${step.number}: ${step.title}`}
                  className="w-full h-48 object-cover"
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
