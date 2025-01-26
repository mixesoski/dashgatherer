import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const Landing = () => {
  return (
    <div className="min-h-screen bg-[#1A1F2C] text-white">
      {/* Navigation */}
      <nav className="container mx-auto px-4 py-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Floxfly</h1>
        <div className="space-x-4">
          <Link to="/login">
            <Button variant="ghost" className="text-white hover:text-white hover:bg-white/10">
              Sign in
            </Button>
          </Link>
          <Link to="/login">
            <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
              Get Started
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-24">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-6xl font-bold leading-tight bg-gradient-to-r from-purple-400 via-pink-500 to-orange-500 text-transparent bg-clip-text">
            Track Your Training Load Like Never Before
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Advanced TRIMP tracking and analysis for athletes who want to optimize their training and reach peak performance.
          </p>
          <div className="flex justify-center gap-4">
            <Link to="/login">
              <Button size="lg" className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                Start Tracking Now
                <ArrowRight className="ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-6 rounded-lg bg-white/5 backdrop-blur-sm">
            <h3 className="text-xl font-semibold mb-4">Garmin Integration</h3>
            <p className="text-gray-400">
              Seamlessly sync your training data from Garmin Connect for automatic TRIMP calculations.
            </p>
          </div>
          <div className="p-6 rounded-lg bg-white/5 backdrop-blur-sm">
            <h3 className="text-xl font-semibold mb-4">Advanced Analytics</h3>
            <p className="text-gray-400">
              Track your Acute Training Load, Chronic Training Load, and Training Stress Balance.
            </p>
          </div>
          <div className="p-6 rounded-lg bg-white/5 backdrop-blur-sm">
            <h3 className="text-xl font-semibold mb-4">Coach Integration</h3>
            <p className="text-gray-400">
              Share your training data with your coach for better guidance and performance optimization.
            </p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="container mx-auto px-4 py-24">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <h2 className="text-4xl font-bold">Ready to Optimize Your Training?</h2>
          <p className="text-xl text-gray-400">
            Join athletes who are already using Floxfly to reach their peak performance.
          </p>
          <Link to="/login">
            <Button size="lg" className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
              Get Started Free
              <ArrowRight className="ml-2" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 border-t border-white/10">
        <div className="flex justify-between items-center">
          <p className="text-gray-400">© 2024 Floxfly. All rights reserved.</p>
          <div className="space-x-4">
            <a href="#" className="text-gray-400 hover:text-white">Privacy Policy</a>
            <a href="#" className="text-gray-400 hover:text-white">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;