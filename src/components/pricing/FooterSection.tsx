
import React from "react";

const FooterSection = () => {
  return (
    <footer className="container mx-auto px-4 py-8 border-t border-white/10">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-gray-400">© 2024 Trimpbara. All rights reserved.</p>
        <div className="flex space-x-4">
          <a href="#" className="text-gray-400 hover:text-white">Privacy Policy</a>
          <a href="#" className="text-gray-400 hover:text-white">Terms of Service</a>
          <a href="#" className="text-gray-400 hover:text-white">Contact</a>
        </div>
      </div>
    </footer>
  );
};

export default FooterSection;
