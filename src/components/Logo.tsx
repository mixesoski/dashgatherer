
import { Link } from "react-router-dom";

interface LogoProps {
  className?: string;
  variant?: "light" | "dark";
}

export const Logo = ({ className = "", variant = "light" }: LogoProps) => {
  const textColor = variant === "light" ? "text-white" : "text-black";
  
  return (
    <Link to="/" className={`flex items-center ${className}`}>
      <h1 className={`text-2xl font-bold ${textColor}`}>
        Trimpbara
      </h1>
    </Link>
  );
};
