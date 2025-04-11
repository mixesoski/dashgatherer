
import { useRef, useEffect, useState } from "react";
import { Activity, BarChart3, Brain, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

const FeatureCarousel = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!trackRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - trackRef.current.offsetLeft);
    setScrollLeft(trackRef.current.scrollLeft);
    document.body.style.cursor = 'grabbing';
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    document.body.style.cursor = 'default';
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !trackRef.current) return;
    e.preventDefault();
    const x = e.pageX - trackRef.current.offsetLeft;
    const walk = (x - startX) * 1.5; // Scroll speed
    trackRef.current.scrollLeft = scrollLeft - walk;
  };

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const features = [
    {
      title: "Training Load Analytics",
      icon: <Activity className="h-8 w-8 text-white" />,
      description: "Track your Acute and Chronic Training Load with sophisticated TRIMP calculations",
      stats: [
        { value: "82", label: "Activity" },
        { value: "71", label: "Sleep" },
        { value: "89", label: "Mental Health" },
        { value: "51", label: "Readiness" }
      ],
      background: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&q=80&w=1800&h=1000"
    },
    {
      title: "Performance Metrics",
      icon: <BarChart3 className="h-8 w-8 text-white" />,
      description: "Monitor your progress with detailed analytics and visualize your journey",
      stats: [
        { value: "8", label: "Sleep Debt" },
        { value: "92", label: "Recovery" },
        { value: "76", label: "Fitness" },
        { value: "63", label: "Fatigue" }
      ],
      background: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80&w=1800&h=1000"
    },
    {
      title: "Behavioral Patterns",
      icon: <Brain className="h-8 w-8 text-white" />,
      description: "Identify patterns in your training and recovery with AI-powered analysis",
      stats: [
        { value: "48%", label: "Engagement" },
        { value: "213", label: "App Opens" },
        { value: "31", label: "Insights" },
        { value: "14", label: "Trends" }
      ],
      background: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&q=80&w=1800&h=1000"
    },
    {
      title: "Coach Integration",
      icon: <Users className="h-8 w-8 text-white" />,
      description: "Share your training data with your coach for personalized feedback",
      stats: [
        { value: "24", label: "Sessions" },
        { value: "97%", label: "Accuracy" },
        { value: "12", label: "Metrics" },
        { value: "8", label: "Reports" }
      ],
      background: "https://images.unsplash.com/photo-1605810230434-7631ac76ec81?auto=format&fit=crop&q=80&w=1800&h=1000"
    }
  ];

  return (
    <section className="draggable-bg-section">
      <div className="container mx-auto px-4">
        <div className="mb-16 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">Understand Your Performance</h2>
          <p className="text-xl text-white/80 max-w-3xl mx-auto">
            Harness real-time training metrics, scores and patterns. Utilize powerful tracking and analytics to understand how your training affects your performance.
          </p>
        </div>
        
        {/* Mobile: Use Carousel for small screens */}
        <div className="lg:hidden">
          <Carousel className="w-full">
            <CarouselContent>
              {features.map((feature, index) => (
                <CarouselItem key={index} className="md:basis-1/2">
                  <div className="p-1">
                    <div 
                      className="glass-card"
                      style={{
                        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.7)), url(${feature.background})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                      }}
                    >
                      <div className="glass-card-content">
                        <div className="glass-card-icon">
                          {feature.icon}
                        </div>
                        <h3 className="glass-card-title">{feature.title}</h3>
                        <p className="glass-card-subtitle">{feature.description}</p>
                        
                        <div className="stats-grid">
                          {feature.stats.map((stat, i) => (
                            <div key={i} className="stat-box">
                              <div className="feature-stat">{stat.value}</div>
                              <div className="feature-stat-label">{stat.label}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="left-2 bg-white/10 hover:bg-white/20 border-none text-white" />
            <CarouselNext className="right-2 bg-white/10 hover:bg-white/20 border-none text-white" />
          </Carousel>
        </div>
        
        {/* Desktop: Use draggable track for larger screens */}
        <div 
          className="hidden lg:block"
          ref={trackRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseUp}
        >
          <div className="feature-track">
            <div className="feature-card-grid" style={{ width: `${features.length * 450}px` }}>
              {features.map((feature, index) => (
                <div 
                  key={index}
                  className="glass-card flex-shrink-0"
                  style={{
                    width: '420px',
                    height: '500px',
                    backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.7)), url(${feature.background})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                >
                  <div className="glass-card-content h-full flex flex-col">
                    <div className="glass-card-icon">
                      {feature.icon}
                    </div>
                    <h3 className="glass-card-title">{feature.title}</h3>
                    <p className="glass-card-subtitle">{feature.description}</p>
                    
                    <div className="stats-grid mt-auto">
                      {feature.stats.map((stat, i) => (
                        <div key={i} className="stat-box">
                          <div className="feature-stat">{stat.value}</div>
                          <div className="feature-stat-label">{stat.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="text-center mt-8 text-white/60 text-sm">
            <p>Drag to explore more features →</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FeatureCarousel;
