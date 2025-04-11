
import { Activity, Award, Compass, Users } from "lucide-react";

const FeatureSection = () => {
  const features = [
    {
      icon: <Activity className="h-8 w-8 text-purple-500" />,
      title: "Advanced Analytics",
      description: "Track your Acute and Chronic Training Load with sophisticated TRIMP calculations for optimal performance.",
      image: "https://images.unsplash.com/photo-1516383274595-37357ded271a?auto=format&fit=crop&q=80&w=800"
    },
    {
      icon: <Compass className="h-8 w-8 text-indigo-500" />,
      title: "Garmin Integration",
      description: "Seamlessly sync your Garmin data and get instant insights into your training load and patterns.",
      image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=800"
    },
    {
      icon: <Users className="h-8 w-8 text-blue-500" />,
      title: "Coach Integration",
      description: "Share your training data with your coach and get personalized feedback to improve faster.",
      image: "https://images.unsplash.com/photo-1576678927484-cc907957088c?auto=format&fit=crop&q=80&w=800"
    },
    {
      icon: <Award className="h-8 w-8 text-purple-500" />,
      title: "Performance Tracking",
      description: "Monitor your progress with detailed analytics and visualize your journey towards peak performance.",
      image: "https://images.unsplash.com/photo-1594882645126-14020914d58d?auto=format&fit=crop&q=80&w=800"
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
              className="p-6 rounded-xl border border-gray-100 shadow-sm bg-white hover:shadow-md transition-shadow duration-300 feature-card"
            >
              <div className="mb-4">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
              <p className="text-gray-600 mb-4">{feature.description}</p>
              <div className="rounded-lg overflow-hidden">
                <img 
                  src={feature.image} 
                  alt={feature.title}
                  className="w-full h-40 object-cover"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeatureSection;
