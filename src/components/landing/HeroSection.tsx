
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

const HeroSection = () => {
  return (
    <section className="hero-section">
      {/* Video background */}
      <div className="video-background">
        <img src="public/lovable-uploads/21904e73-7326-49a5-b1de-e86a240e49a2.png" alt="Training background" />
        {/* Fallback if we had a video: */}
        {/* <video autoPlay muted loop playsInline>
          <source src="/videos/hero-background.mp4" type="video/mp4" />
        </video> */}
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
