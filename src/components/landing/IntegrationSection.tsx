
const IntegrationSection = () => {
  // Define integration logos with images
  const integrations = [
    {
      name: "Garmin Connect",
      logo: "https://images.unsplash.com/photo-1505751171710-1f6d0ace5a85?auto=format&fit=crop&q=80&w=400"
    },
    {
      name: "Strava",
      logo: "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&q=80&w=400"
    },
    {
      name: "Apple Health",
      logo: "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?auto=format&fit=crop&q=80&w=400"
    },
    {
      name: "Google Fit",
      logo: "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&q=80&w=400"
    },
    {
      name: "Polar",
      logo: "https://images.unsplash.com/photo-1544027993-37dbfe43562a?auto=format&fit=crop&q=80&w=400"
    }
  ];

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Seamless Integrations</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Trimpbara works with the tools and devices you already use.
          </p>
        </div>

        <div className="flex flex-wrap justify-center items-center gap-12 max-w-4xl mx-auto">
          {integrations.map((integration, index) => (
            <div key={index} className="w-32 h-16 rounded overflow-hidden shadow-sm">
              <img 
                src={integration.logo} 
                alt={integration.name} 
                className="w-full h-full object-cover"
                title={integration.name}
              />
            </div>
          ))}
        </div>

        <div className="mt-16 max-w-3xl mx-auto text-center">
          <p className="text-gray-600">
            Trimpbara integrates seamlessly with Garmin Connect and other popular fitness platforms, making it easy to synchronize your training data and get the insights you need to improve your performance.
          </p>
        </div>
      </div>
    </section>
  );
};

export default IntegrationSection;
