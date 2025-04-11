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
  return;
};
export default TestimonialsSection;