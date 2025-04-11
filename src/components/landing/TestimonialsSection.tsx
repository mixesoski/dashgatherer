
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";

const testimonialsData = [
  {
    quote: "Trimpbara has completely changed how I train. The insights from TRIMP analysis have helped me optimize my workouts and reach new personal records.",
    name: "Alex M.",
    title: "Marathon Runner",
    avatar: "/placeholder.svg"
  },
  {
    quote: "As a coach, I love being able to monitor my athletes' training load in real-time. It helps me adjust their programs for optimal results without overtraining.",
    name: "Sarah K.",
    title: "Professional Coach",
    avatar: "/placeholder.svg"
  },
  {
    quote: "The ability to track ATL and CTL has been game-changing for my cycling performance. I can now plan my peak performance with scientific precision.",
    name: "Michael T.",
    title: "Cyclist",
    avatar: "/placeholder.svg"
  }
];

const TestimonialsSection = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const testimonialsRef = useRef<HTMLDivElement>(null);

  const goToPrevious = () => {
    setActiveIndex((prev) => (prev === 0 ? testimonialsData.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setActiveIndex((prev) => (prev === testimonialsData.length - 1 ? 0 : prev + 1));
  };

  return (
    <section className="py-20 bg-gradient-to-r from-indigo-50 to-purple-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">What Our Users Say</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Hear from athletes and coaches who have transformed their training with Trimpbara.
          </p>
        </div>

        <div className="max-w-4xl mx-auto relative">
          <div 
            ref={testimonialsRef}
            className="overflow-hidden relative"
          >
            <div 
              className="flex transition-transform duration-500 ease-in-out"
              style={{ transform: `translateX(-${activeIndex * 100}%)` }}
            >
              {testimonialsData.map((testimonial, index) => (
                <div key={index} className="min-w-full px-4">
                  <div className="bg-white rounded-xl p-8 shadow-lg">
                    <Quote className="h-10 w-10 text-purple-200 mb-4" />
                    <p className="text-xl text-gray-700 italic mb-6">{testimonial.quote}</p>
                    <div className="flex items-center">
                      <div className="w-12 h-12 rounded-full bg-gray-200 mr-4 overflow-hidden">
                        <img 
                          src={testimonial.avatar} 
                          alt={testimonial.name} 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <h4 className="font-bold">{testimonial.name}</h4>
                        <p className="text-gray-600 text-sm">{testimonial.title}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation arrows */}
          <Button 
            onClick={goToPrevious}
            className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1/2 bg-white text-gray-700 rounded-full p-2 shadow-md hover:bg-gray-50"
            size="icon"
            variant="ghost"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <Button 
            onClick={goToNext}
            className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-1/2 bg-white text-gray-700 rounded-full p-2 shadow-md hover:bg-gray-50"
            size="icon"
            variant="ghost"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>

          {/* Dots indicator */}
          <div className="flex justify-center mt-8 space-x-2">
            {testimonialsData.map((_, index) => (
              <button
                key={index}
                onClick={() => setActiveIndex(index)}
                className={`w-3 h-3 rounded-full transition-colors ${
                  activeIndex === index ? 'bg-purple-600' : 'bg-gray-300'
                }`}
                aria-label={`Go to testimonial ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
