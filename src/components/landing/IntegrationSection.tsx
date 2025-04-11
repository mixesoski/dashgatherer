
const IntegrationSection = () => {
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
          {/* Placeholder for integration logos */}
          {[1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="w-32 h-16 bg-gray-100 rounded flex items-center justify-center">
              <p className="text-gray-500">Integration {item}</p>
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
