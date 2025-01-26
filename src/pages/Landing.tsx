import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles } from "@/components/ui/sparkles";

const Landing = () => {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Navigation */}
      <nav className="container mx-auto px-4 py-6 flex justify-between items-center">
        <h1 className="text-2xl text-white font-bold">
          <Sparkles>Trimpbara</Sparkles>
        </h1>
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
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h1 className="text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-pink-500">
            <Sparkles>
              Track Your Training Load Like Never Before
            </Sparkles>
          </h1>
          <p className="text-xl text-gray-400">
            Advanced analytics and insights for athletes who want to optimize their training and reach peak performance.
          </p>
          <div className="flex justify-center gap-4">
            <Link to="/login">
              <Button size="lg" className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                Start Tracking Now
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="p-6 rounded-lg bg-white/5 backdrop-blur-xl border border-white/10">
            <h3 className="text-xl font-bold mb-4">Garmin Integration</h3>
            <p className="text-gray-400">
              Seamlessly sync your Garmin data and get instant insights into your training load.
            </p>
          </div>
          <div className="p-6 rounded-lg bg-white/5 backdrop-blur-xl border border-white/10">
            <h3 className="text-xl font-bold mb-4">Advanced Analytics</h3>
            <p className="text-gray-400">
              Track your Acute and Chronic Training Load with sophisticated TRIMP calculations.
            </p>
          </div>
          <div className="p-6 rounded-lg bg-white/5 backdrop-blur-xl border border-white/10">
            <h3 className="text-xl font-bold mb-4">Coach Integration</h3>
            <p className="text-gray-400">
              Share your training data with your coach and get personalized feedback.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <h2 className="text-4xl font-bold">
            <Sparkles>Ready to Optimize Your Training?</Sparkles>
          </h2>
          <p className="text-xl text-gray-400">
            Join athletes who are already using Trimpbara to reach their peak performance.
          </p>
          <Link to="/login">
            <Button size="lg" className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
              Get Started Now
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 border-t border-white/10">
        <div className="flex justify-between items-center">
          <p className="text-gray-400">© 2024 Trimpbara. All rights reserved.</p>
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