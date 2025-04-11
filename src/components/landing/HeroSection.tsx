
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

const HeroSection = () => {
  return (
    <section className="hero-section">
      {/* Video background */}
      <div className="video-background">
        <img 
          src="https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1920&h=1080" 
          alt="Training background" 
          className="w-full h-full object-cover" 
        />
      </div>
      
      {/* Content overlay */}
      <div className="content-overlay container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto">
          <div className="hero-logo">
            <Logo variant="dark" />
          </div>
          
          <h2 className="hero-subtitle">THE NEXT GENERATION PLATFORM FOR:</h2>
          
          <h1 className="hero-title">
            Athletic<br />
            Performance Tracking
          </h1>
          
          <Link to="/login">
            <Button size="lg" className="hero-cta">
              Activate tracking beyond your workouts
            </Button>
          </Link>
          
          <p className="hero-description">
            The most powerful analytics platform you can use to build, track, and optimize your athletic performance.
          </p>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
