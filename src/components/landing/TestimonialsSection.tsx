
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";

const testimonialsData = [{
  quote: "Trimpbara has completely changed how I train. The insights from TRIMP analysis have helped me optimize my workouts and reach new personal records.",
  name: "Alex M.",
  title: "Marathon Runner",
  avatar: "https://images.unsplash.com/photo-1542327897-4141b355e20e?auto=format&fit=crop&q=80&w=150"
}, {
  quote: "As a coach, I love being able to monitor my athletes' training load in real-time. It helps me adjust their programs for optimal results without overtraining.",
  name: "Sarah K.",
  title: "Professional Coach",
  avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=150"
}, {
  quote: "The ability to track ATL and CTL has been game-changing for my cycling performance. I can now plan my peak performance with scientific precision.",
  name: "Michael T.",
  title: "Cyclist",
  avatar: "https://images.unsplash.com/photo-1567037782848-b071163a3f24?auto=format&fit=crop&q=80&w=150"
}];

const TestimonialsSection = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const testimonialsRef = useRef<HTMLDivElement>(null);

  const goToPrevious = () => {
    setActiveIndex(prev => prev === 0 ? testimonialsData.length - 1 : prev - 1);
  };
  
  const goToNext = () => {
    setActiveIndex(prev => prev === testimonialsData.length - 1 ? 0 : prev + 1);
  };

  return (
    <section className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">What Athletes Say</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Hear from athletes and coaches who have transformed their training with Trimpbara.
          </p>
        </div>

        <div className="max-w-4xl mx-auto relative" ref={testimonialsRef}>
          <div className="bg-white rounded-xl shadow-lg p-8 md:p-12">
            <div className="flex justify-center mb-6">
              <Quote className="text-purple-500" size={48} />
            </div>
            
            <blockquote className="text-center mb-8">
              <p className="text-xl md:text-2xl text-gray-800 italic mb-6">
                "{testimonialsData[activeIndex].quote}"
              </p>
              <div className="flex items-center justify-center">
                <img 
                  src={testimonialsData[activeIndex].avatar} 
                  alt={testimonialsData[activeIndex].name} 
                  className="w-16 h-16 rounded-full object-cover mr-4"
                />
                <div className="text-left">
                  <div className="font-bold text-lg">{testimonialsData[activeIndex].name}</div>
                  <div className="text-gray-600">{testimonialsData[activeIndex].title}</div>
                </div>
              </div>
            </blockquote>
            
            <div className="flex justify-center gap-4">
              <Button 
                variant="outline" 
                size="icon" 
                onClick={goToPrevious}
                className="rounded-full"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {testimonialsData.map((_, index) => (
                <Button 
                  key={index}
                  variant={index === activeIndex ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveIndex(index)}
                  className="rounded-full w-2 h-2 p-0 min-w-0"
                />
              ))}
              <Button 
                variant="outline" 
                size="icon" 
                onClick={goToNext}
                className="rounded-full"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
