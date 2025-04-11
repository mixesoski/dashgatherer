
import { Activity, Award, Compass, Users } from "lucide-react";

const FeatureSection = () => {
  const features = [
    {
      icon: <Activity className="h-8 w-8 text-purple-500" />,
      title: "Advanced Analytics",
      description: "Track your Acute and Chronic Training Load with sophisticated TRIMP calculations for optimal performance."
    },
    {
      icon: <Compass className="h-8 w-8 text-indigo-500" />,
      title: "Garmin Integration",
      description: "Seamlessly sync your Garmin data and get instant insights into your training load and patterns."
    },
    {
      icon: <Users className="h-8 w-8 text-blue-500" />,
      title: "Coach Integration",
      description: "Share your training data with your coach and get personalized feedback to improve faster."
    },
    {
      icon: <Award className="h-8 w-8 text-purple-500" />,
      title: "Performance Tracking",
      description: "Monitor your progress with detailed analytics and visualize your journey towards peak performance."
    }
  ];

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Powerful Features for Athletes</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Our platform provides everything you need to optimize your training and reach your performance goals.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="p-6 rounded-xl border border-gray-100 shadow-sm bg-white hover:shadow-md transition-shadow duration-300"
            >
              <div className="mb-4">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
              <p className="text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeatureSection;
