
import { Link } from "react-router-dom";

interface LogoProps {
  className?: string;
  variant?: "light" | "dark";
}

export const Logo = ({ className = "", variant = "light" }: LogoProps) => {
  const textColor = variant === "light" ? "text-white" : "text-black";
  
  return (
    <Link to="/" className={`flex items-center ${className}`}>
      <div className="relative">
        <h1 className={`text-2xl font-bold ${textColor}`}>
          Trimpbara
        </h1>
        <div className="absolute top-0 right-0 -mt-2 -mr-12">
          <div className="relative">
            <svg width="60" height="30" viewBox="0 0 60 30">
              <rect 
                x="4" 
                y="4" 
                width="52" 
                height="22" 
                rx="4" 
                ry="4" 
                fill="#f471b5" 
              />
              <text 
                x="30" 
                y="19" 
                fontFamily="Arial" 
                fontSize="12" 
                fontWeight="bold" 
                fill="black" 
                textAnchor="middle" 
                dominantBaseline="middle"
              >
                BETA
              </text>
            </svg>
          </div>
        </div>
      </div>
    </Link>
  );
};
