"use client";

import { cn } from "@/lib/utils";
import React, { useEffect, useState } from "react";

export const Sparkles = ({
  children,
  className,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const [sparkles, setSparkles] = useState<Array<{ id: number; x: number; y: number; size: number }>>([]);
  const [showing, setShowing] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      const sparkle = {
        id: Date.now(),
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 3 + 1,
      };
      setSparkles((prev) => [...prev, sparkle]);
      setTimeout(() => {
        setSparkles((prev) => prev.filter((s) => s.id !== sparkle.id));
      }, 500);
    }, 50);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className={cn("relative inline-block", className)} {...props}>
      {sparkles.map((sparkle) => (
        <div
          key={sparkle.id}
          className="absolute pointer-events-none animate-sparkle"
          style={{
            left: `${sparkle.x}%`,
            top: `${sparkle.y}%`,
            width: `${sparkle.size}px`,
            height: `${sparkle.size}px`,
          }}
        >
          <svg
            className="absolute animate-ping"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z"
              fill="currentColor"
            />
          </svg>
        </div>
      ))}
      <div className={showing ? "transition duration-300" : "opacity-0 transition duration-300"}>
        {children}
      </div>
    </div>
  );
};