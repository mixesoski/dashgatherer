
import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

const NavBar = () => {
  return (
    <nav className="container mx-auto px-4 py-6 flex justify-between items-center">
      <Logo variant="light" />
      <div className="space-x-4">
        <Link to="/login">
          <Button variant="ghost" className="text-white hover:text-white hover:bg-white/10">
            Sign in
          </Button>
        </Link>
        <Link to="/login">
          <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
            Get Started
          </Button>
        </Link>
      </div>
    </nav>
  );
};

export default NavBar;
