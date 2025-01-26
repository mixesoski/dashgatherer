import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Landing = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-purple-500 to-yellow-500">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto text-white">
          <h1 className="text-6xl font-bold mb-6">Floxfly</h1>
          <p className="text-xl mb-8">
            Track and analyze your training data with precision
          </p>
          <div className="space-x-4">
            <Link to="/login">
              <Button variant="outline" className="bg-white text-black hover:bg-gray-100">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Landing;