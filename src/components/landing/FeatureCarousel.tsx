
import { useRef, useEffect, useState } from "react";
import { Activity, BarChart3, Brain, Users } from "lucide-react";
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
      chartType: "line",
      chartData: {
        labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        datasets: [
          {
            label: "ATL",
            data: [42, 49, 52, 74, 79, 86, 82],
            borderColor: "rgba(255, 99, 132, 0.8)",
            backgroundColor: "rgba(255, 99, 132, 0.2)",
            fill: true,
            tension: 0.4
          },
          {
            label: "CTL",
            data: [30, 35, 40, 45, 52, 58, 63],
            borderColor: "rgba(54, 162, 235, 0.8)",
            backgroundColor: "rgba(54, 162, 235, 0.2)",
            fill: true,
            tension: 0.4
          }
        ]
      },
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
      chartType: "bar",
      chartData: {
        labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
        datasets: [
          {
            label: "Fitness",
            data: [65, 72, 76, 85],
            backgroundColor: "rgba(75, 192, 192, 0.7)"
          },
          {
            label: "Fatigue",
            data: [70, 82, 73, 63],
            backgroundColor: "rgba(255, 159, 64, 0.7)"
          }
        ]
      },
      background: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80&w=1800&h=1000"
    },
    {
      title: "Training Stress Balance",
      icon: <Brain className="h-8 w-8 text-white" />,
      description: "Visualize your Training Stress Balance (TSB) to optimize performance and recovery",
      stats: [
        { value: "14", label: "TSB" },
        { value: "83", label: "Form" },
        { value: "31", label: "Insights" },
        { value: "75", label: "Productivity" }
      ],
      chartType: "area",
      chartData: {
        labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
        datasets: [
          {
            label: "TSB",
            data: [-5, -10, 5, 15, 8, 14],
            borderColor: "rgba(153, 102, 255, 0.8)",
            backgroundColor: "rgba(153, 102, 255, 0.2)",
            fill: true,
            tension: 0.4
          }
        ]
      },
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
      chartType: "radar",
      chartData: {
        labels: [
          "Endurance",
          "Speed",
          "Power",
          "Technique",
          "Recovery",
          "Nutrition"
        ],
        datasets: [
          {
            label: "Current",
            data: [65, 59, 90, 81, 56, 55],
            fill: true,
            backgroundColor: "rgba(54, 162, 235, 0.2)",
            borderColor: "rgba(54, 162, 235, 0.8)",
            pointBackgroundColor: "rgba(54, 162, 235, 1)",
            pointBorderColor: "#fff",
            pointHoverBackgroundColor: "#fff",
            pointHoverBorderColor: "rgba(54, 162, 235, 1)"
          },
          {
            label: "Target",
            data: [75, 70, 95, 85, 65, 70],
            fill: true,
            backgroundColor: "rgba(255, 99, 132, 0.2)",
            borderColor: "rgba(255, 99, 132, 0.8)",
            pointBackgroundColor: "rgba(255, 99, 132, 1)",
            pointBorderColor: "#fff",
            pointHoverBackgroundColor: "#fff",
            pointHoverBorderColor: "rgba(255, 99, 132, 1)"
          }
        ]
      },
      background: "https://images.unsplash.com/photo-1605810230434-7631ac76ec81?auto=format&fit=crop&q=80&w=1800&h=1000"
    }
  ];

  // Render chart based on type
  const renderChart = (feature: any) => {
    // This is just a visual representation - we'll render SVG paths that look like the charts
    return (
      <div className="chart-visualization mt-4 p-3 bg-white/10 rounded-lg">
        {feature.chartType === "line" && (
          <svg viewBox="0 0 100 50" className="w-full h-32">
            {/* Line chart for ATL */}
            <path
              d="M10,40 L20,35 L30,32 L40,20 L50,15 L60,10 L70,12"
              fill="none"
              stroke="rgba(255, 99, 132, 0.8)"
              strokeWidth="2"
            />
            {/* Line chart for CTL */}
            <path
              d="M10,45 L20,42 L30,40 L40,37 L50,32 L60,28 L70,25"
              fill="none"
              stroke="rgba(54, 162, 235, 0.8)"
              strokeWidth="2"
            />
            {/* Area fill for ATL */}
            <path
              d="M10,40 L20,35 L30,32 L40,20 L50,15 L60,10 L70,12 L70,50 L10,50 Z"
              fill="rgba(255, 99, 132, 0.2)"
              stroke="none"
            />
            {/* Area fill for CTL */}
            <path
              d="M10,45 L20,42 L30,40 L40,37 L50,32 L60,28 L70,25 L70,50 L10,50 Z"
              fill="rgba(54, 162, 235, 0.2)"
              stroke="none"
            />
          </svg>
        )}
        
        {feature.chartType === "bar" && (
          <svg viewBox="0 0 100 50" className="w-full h-32">
            {/* First dataset bars */}
            <rect x="10" y="20" width="8" height="30" fill="rgba(75, 192, 192, 0.7)" />
            <rect x="30" y="16" width="8" height="34" fill="rgba(75, 192, 192, 0.7)" />
            <rect x="50" y="14" width="8" height="36" fill="rgba(75, 192, 192, 0.7)" />
            <rect x="70" y="8" width="8" height="42" fill="rgba(75, 192, 192, 0.7)" />
            
            {/* Second dataset bars */}
            <rect x="20" y="15" width="8" height="35" fill="rgba(255, 159, 64, 0.7)" />
            <rect x="40" y="10" width="8" height="40" fill="rgba(255, 159, 64, 0.7)" />
            <rect x="60" y="15" width="8" height="35" fill="rgba(255, 159, 64, 0.7)" />
            <rect x="80" y="20" width="8" height="30" fill="rgba(255, 159, 64, 0.7)" />
          </svg>
        )}
        
        {feature.chartType === "area" && (
          <svg viewBox="0 0 100 50" className="w-full h-32">
            <path
              d="M10,30 L20,35 L30,25 L40,15 L50,22 L60,16 L70,16 L70,50 L10,50 Z"
              fill="rgba(153, 102, 255, 0.2)"
              stroke="none"
            />
            <path
              d="M10,30 L20,35 L30,25 L40,15 L50,22 L60,16 L70,16"
              fill="none"
              stroke="rgba(153, 102, 255, 0.8)"
              strokeWidth="2"
            />
            {/* Add a middle line to represent zero */}
            <line
              x1="10"
              y1="30"
              x2="90"
              y2="30"
              stroke="rgba(255, 255, 255, 0.3)"
              strokeWidth="1"
              strokeDasharray="2"
            />
          </svg>
        )}
        
        {feature.chartType === "radar" && (
          <svg viewBox="0 0 100 100" className="w-full h-32">
            {/* Radar chart web */}
            <polygon
              points="50,10 90,50 50,90 10,50"
              fill="none"
              stroke="rgba(255, 255, 255, 0.2)"
              strokeWidth="1"
            />
            <polygon
              points="50,20 80,50 50,80 20,50"
              fill="none"
              stroke="rgba(255, 255, 255, 0.2)"
              strokeWidth="1"
            />
            <polygon
              points="50,30 70,50 50,70 30,50"
              fill="none"
              stroke="rgba(255, 255, 255, 0.2)"
              strokeWidth="1"
            />
            
            {/* Current dataset */}
            <polygon
              points="50,20 75,40 65,70 35,70 25,40"
              fill="rgba(54, 162, 235, 0.2)"
              stroke="rgba(54, 162, 235, 0.8)"
              strokeWidth="2"
            />
            
            {/* Target dataset */}
            <polygon
              points="50,15 80,35 70,75 30,75 20,35"
              fill="rgba(255, 99, 132, 0.2)"
              stroke="rgba(255, 99, 132, 0.8)"
              strokeWidth="2"
              strokeDasharray="3"
            />
          </svg>
        )}
      </div>
    );
  };

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
                        
                        {renderChart(feature)}
                        
                        <div className="stats-grid mt-4">
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
                    
                    {renderChart(feature)}
                    
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
