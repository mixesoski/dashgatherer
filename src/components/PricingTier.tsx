
import React from "react";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface PricingTierProps {
  title: string;
  price: string | React.ReactNode;
  description: string;
  features: string[];
  buttonText: string;
  buttonVariant?: "default" | "outline" | "ghost";
  highlighted?: boolean;
  buttonHref: string;
  priceDescription?: string;
  customCardStyle?: string;
}

export const PricingTier = ({
  title,
  price,
  description,
  features,
  buttonText,
  buttonVariant = "default",
  highlighted = false,
  buttonHref,
  priceDescription,
  customCardStyle,
}: PricingTierProps) => {
  return (
    <Card className={`flex flex-col ${highlighted ? 'border-purple-500 shadow-lg relative overflow-hidden' : customCardStyle || 'bg-white/5 backdrop-blur-xl border border-white/10'}`}>
      {highlighted && (
        <div className="absolute top-0 right-0 -mt-2 -mr-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold rounded-bl-lg px-3 py-1 transform rotate-12">
          Popular
        </div>
      )}
      <CardHeader>
        <CardTitle className="text-xl font-bold">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <div className="text-center">
          <div className="text-4xl font-bold">{price}</div>
          {priceDescription && (
            <p className="text-sm text-gray-400">{priceDescription}</p>
          )}
        </div>
        <ul className="space-y-2">
          {features.map((feature, index) => (
            <li key={index} className="flex items-center gap-2">
              <Check size={16} className="text-green-500 flex-shrink-0" />
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="pt-4">
        <Link to={buttonHref} className="w-full">
          <Button
            variant={buttonVariant}
            className={`w-full ${
              highlighted
                ? "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                : ""
            }`}
          >
            {buttonText}
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
};
