
import React from "react";
import { Link } from "react-router-dom";
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Check, X, HelpCircle } from "lucide-react";

const FeatureComparison = () => {
  const features = [
    { 
      name: "Garmin Integration", 
      trial: "Limited", 
      coach: "View Only", 
      athlete: "Full", 
      organization: "Full" 
    },
    { 
      name: "Training Load Analytics", 
      trial: "Basic", 
      coach: "View Only", 
      athlete: "Advanced", 
      organization: "Advanced" 
    },
    { 
      name: "Data History", 
      trial: "7 days", 
      coach: "Athlete dependent", 
      athlete: "Unlimited", 
      organization: "Unlimited" 
    },
    { 
      name: "Coach Sharing", 
      trial: "Limited", 
      coach: "N/A", 
      athlete: "Full", 
      organization: "Full" 
    },
    { 
      name: "Multiple Athletes Management", 
      trial: false, 
      coach: "Limited", 
      athlete: false, 
      organization: "Unlimited" 
    },
    { 
      name: "Team Analytics", 
      trial: false, 
      coach: "Basic", 
      athlete: false, 
      organization: "Advanced" 
    },
    { 
      name: "Email Support", 
      trial: "Basic", 
      coach: "Basic", 
      athlete: "Priority", 
      organization: "Premium" 
    },
    { 
      name: "Custom Features", 
      trial: false, 
      coach: false, 
      athlete: false, 
      organization: true 
    },
    { 
      name: "API Access", 
      trial: false, 
      coach: false, 
      athlete: "Limited", 
      organization: "Full" 
    },
    { 
      name: "Dedicated Account Manager", 
      trial: false, 
      coach: false, 
      athlete: false, 
      organization: true 
    },
  ];

  const renderFeatureStatus = (value: string | boolean) => {
    if (value === true) {
      return <Check className="mx-auto text-green-500" size={20} />;
    } else if (value === false) {
      return <X className="mx-auto text-red-500" size={20} />;
    } else {
      return <span className="text-sm">{value}</span>;
    }
  };

  return (
    <section className="container mx-auto px-4 py-20">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold mb-8 text-center">Feature Comparison</h2>
        
        <div className="overflow-x-auto rounded-lg border border-white/10 bg-white/5 backdrop-blur-xl">
          <Table>
            <TableCaption>Detailed feature comparison between all plans</TableCaption>
            <TableHeader>
              <TableRow className="bg-black/30">
                <TableHead className="w-[250px]">Feature</TableHead>
                <TableHead className="text-center">Trial</TableHead>
                <TableHead className="text-center">Coach</TableHead>
                <TableHead className="text-center bg-gradient-to-r from-purple-500/20 to-pink-500/20">Athlete</TableHead>
                <TableHead className="text-center">Organization</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {features.map((feature, index) => (
                <TableRow key={index} className={index % 2 === 0 ? "bg-black/10" : ""}>
                  <TableCell className="font-medium">{feature.name}</TableCell>
                  <TableCell className="text-center">{renderFeatureStatus(feature.trial)}</TableCell>
                  <TableCell className="text-center">{renderFeatureStatus(feature.coach)}</TableCell>
                  <TableCell className="text-center bg-gradient-to-r from-purple-500/5 to-pink-500/5">{renderFeatureStatus(feature.athlete)}</TableCell>
                  <TableCell className="text-center">{renderFeatureStatus(feature.organization)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        <div className="mt-8 text-center">
          <p className="text-gray-400 flex items-center justify-center gap-2">
            <HelpCircle size={16} /> 
            Need help choosing the right plan? <Link to="/login" className="text-purple-400 hover:text-purple-300">Contact our team</Link>
          </p>
        </div>
      </div>
    </section>
  );
};

export default FeatureComparison;
