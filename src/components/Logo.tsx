
import { Link } from "react-router-dom";

interface LogoProps {
  className?: string;
  variant?: "light" | "dark";
}

export const Logo = ({ className = "", variant = "light" }: LogoProps) => {
  const textColor = variant === "light" ? "text-white" : "text-gray-900";
  
  return (
    <Link to="/" className={`flex items-center ${className}`}>
      <div className="relative">
        <h1 className={`text-2xl font-bold ${textColor} flex items-center`}>
          Trimpbara
          <div className="ml-2 px-2 py-0.5 text-xs font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-full">
            BETA
          </div>
        </h1>
      </div>
    </Link>
  );
};
