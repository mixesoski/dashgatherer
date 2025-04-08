
import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, Info } from "lucide-react";
import { Logo } from "@/components/Logo";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <nav className="container mx-auto px-4 py-6 flex justify-between items-center">
        <Link to="/">
          <Logo variant="light" />
        </Link>
        <Link to="/">
          <Button variant="outline" className="text-white border-white hover:bg-white/10">
            Back to Home
          </Button>
        </Link>
      </nav>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-8">
          <Shield className="h-8 w-8 text-purple-500" />
          <h1 className="text-3xl md:text-4xl font-bold">Privacy Policy</h1>
        </div>

        <div className="space-y-8 text-gray-300">
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Introduction</h2>
            <p>
              Trimpbara ("we", "our", "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our application and services. Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please do not access the application.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Information We Collect</h2>
            <p className="mb-4">
              We collect information that you provide directly to us when you:
            </p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>Create an account</li>
              <li>Use our services</li>
              <li>Connect your Garmin account</li>
              <li>Communicate with us</li>
            </ul>
            <p className="mb-4">
              <strong>Garmin Account Data:</strong> When you connect your Garmin account, we access fitness and activity data through the Garmin API, including but not limited to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Activity metrics (duration, distance, heart rate, etc.)</li>
              <li>Training load data</li>
              <li>Activity dates and times</li>
              <li>Activity types</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">How We Use Your Information</h2>
            <p className="mb-4">We use the information we collect to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide, maintain, and improve our services</li>
              <li>Calculate training metrics such as TRIMP, ATL, CTL, and TSB</li>
              <li>Process and analyze your training data</li>
              <li>Communicate with you about our services</li>
              <li>Monitor and analyze usage patterns</li>
              <li>Detect, prevent, and address technical issues</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Data Storage and Security</h2>
            <p className="mb-4">
              We implement appropriate technical and organizational measures to protect your personal information against unauthorized or unlawful processing, accidental loss, destruction, or damage. However, no method of transmission over the Internet or electronic storage is 100% secure.
            </p>
            <p>
              Your data is stored in secure cloud databases provided by our hosting partners. We retain your data as long as your account is active or as needed to provide services to you. We may retain and use your data as necessary to comply with legal obligations, resolve disputes, and enforce agreements.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Garmin API Compliance</h2>
            <p className="mb-4">
              Our use of Garmin data complies with Garmin's API Terms of Service. Specifically:
            </p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>We only access data necessary for providing our training load analysis services</li>
              <li>We do not use Garmin data for advertising purposes</li>
              <li>We provide clear descriptions of what data we collect and how we use it</li>
              <li>We allow users to disconnect their Garmin account at any time</li>
              <li>We do not share your Garmin data with third parties without your consent</li>
              <li>We implement strong security measures to protect your Garmin data</li>
            </ul>
            <p>
              When you disconnect your Garmin account from Trimpbara, we will no longer retrieve new data from Garmin, although previously synced data may remain in your Trimpbara account until you delete your account.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Sharing Your Information</h2>
            <p className="mb-4">
              We do not sell, trade, rent, or otherwise transfer your personal information to third parties without your consent, except as described below:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Coach Sharing:</strong> If you choose to share your training data with a coach through our platform, they will have access to your activity data and metrics.</li>
              <li><strong>Service Providers:</strong> We may share information with third-party vendors and service providers that provide services for us or on our behalf, such as database management, web hosting, and payment processing.</li>
              <li><strong>Legal Requirements:</strong> We may disclose your information if required to do so by law or in response to valid requests by public authorities.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Your Rights</h2>
            <p className="mb-4">
              Depending on your location, you may have rights related to your personal information. These may include:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Access to your personal information</li>
              <li>Correction of inaccurate or incomplete information</li>
              <li>Deletion of your personal information</li>
              <li>Restriction of processing of your personal information</li>
              <li>Data portability</li>
              <li>Objection to processing of your personal information</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Children's Privacy</h2>
            <p>
              Our service is not directed to children under the age of 16. We do not knowingly collect personal information from children under 16. If we learn that we have collected personal information from a child under 16 without verification of parental consent, we will take steps to remove that information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Changes to This Privacy Policy</h2>
            <p>
              We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date. You are advised to review this Privacy Policy periodically for any changes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Contact Us</h2>
            <p className="mb-4">
              If you have any questions about this Privacy Policy, please contact us at:
            </p>
            <div className="flex items-center p-4 bg-white/5 rounded-lg">
              <Info className="h-5 w-5 text-purple-500 mr-3" />
              <span>contact@trimpbara.com</span>
            </div>
          </section>

          <div className="mt-8 py-4 border-t border-white/10">
            <p className="text-sm text-gray-400">Last Updated: April 8, 2025</p>
          </div>
        </div>
      </main>

      <footer className="container mx-auto px-4 py-8 border-t border-white/10">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-400">© 2024 Trimpbara. All rights reserved.</p>
          <div className="flex space-x-4">
            <Link to="/privacy-policy" className="text-gray-400 hover:text-white">Privacy Policy</Link>
            <Link to="/" className="text-gray-400 hover:text-white">Terms of Service</Link>
            <a href="mailto:contact@trimpbara.com" className="text-gray-400 hover:text-white">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PrivacyPolicy;
