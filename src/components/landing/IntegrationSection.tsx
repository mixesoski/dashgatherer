
import React from 'react';
import { SiGarmin } from 'react-icons/si';

const IntegrationSection = () => {
  // Update integrations to focus on Garmin
  const integrations = [
    {
      name: "Garmin Connect",
      logo: <SiGarmin className="text-green-600 w-16 h-16" />
    }
  ];

  return (
    <section className="py-20 bg-[#1A1F2C] text-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">Seamless Garmin Integration</h2>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Trimpbara works directly with Garmin Connect, providing seamless synchronization of your training data.
          </p>
        </div>

        <div className="flex justify-center items-center gap-12 max-w-4xl mx-auto">
          {integrations.map((integration, index) => (
            <div 
              key={index} 
              className="w-32 h-32 flex items-center justify-center rounded-xl bg-[#222932] shadow-lg"
            >
              {integration.logo}
            </div>
          ))}
        </div>

        <div className="mt-16 max-w-3xl mx-auto text-center">
          <p className="text-gray-400">
            Our direct integration with Garmin Connect ensures that your training metrics are automatically synchronized, 
            giving you real-time insights into your performance and training load.
          </p>
        </div>
      </div>
    </section>
  );
};

export default IntegrationSection;
