import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { ArrowLeft } from 'lucide-react';

export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Logo />
          <Button variant="outline" asChild>
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Link>
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <h1 className="text-4xl font-display font-bold mb-8">Terms of Service</h1>
        
        <div className="prose prose-lg max-w-none text-foreground">
          <p className="text-muted-foreground mb-8">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">1. Acceptance of Terms</h2>
            <p className="mb-4 text-foreground">
              By accessing or using the Llumos Free Brand Visibility Checker service ("Service"), you agree to be bound by these Terms of Service ("Terms"). 
              If you do not agree to these Terms, please do not use our Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">2. Description of Service</h2>
            <p className="mb-4 text-foreground">
              The Free Brand Visibility Checker is a complimentary service that analyzes your brand's presence 
              across AI platforms including ChatGPT, Gemini, and Perplexity. We provide:
            </p>
            <ul className="list-disc list-inside space-y-2 mb-4 text-foreground">
              <li>AI visibility analysis across multiple platforms</li>
              <li>Brand mention detection and scoring</li>
              <li>Competitive positioning insights</li>
              <li>Email delivery of analysis results</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">3. User Responsibilities</h2>
            <p className="mb-4 text-foreground">When using our Service, you agree to:</p>
            <ul className="list-disc list-inside space-y-2 mb-4 text-foreground">
              <li>Provide accurate and complete information</li>
              <li>Use the Service only for legitimate business purposes</li>
              <li>Not attempt to circumvent any limitations or restrictions</li>
              <li>Not use the Service to violate any laws or regulations</li>
              <li>Not reverse engineer or attempt to extract our algorithms</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">4. Free Service Limitations</h2>
            <p className="mb-4 text-foreground">
              The Free Brand Visibility Checker is provided as a limited, complimentary service:
            </p>
            <ul className="list-disc list-inside space-y-2 mb-4 text-foreground">
              <li>Analysis is based on a sample of AI platform responses</li>
              <li>Results are estimates and may not reflect complete market conditions</li>
              <li>Service availability is not guaranteed and may be limited</li>
              <li>No service level agreements or uptime guarantees apply</li>
              <li>We reserve the right to limit usage to prevent abuse</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">5. Intellectual Property</h2>
            <p className="mb-4 text-foreground">
              The Service, including all content, features, and functionality, is owned by Llumos, Inc. and is protected by:
            </p>
            <ul className="list-disc list-inside space-y-2 mb-4 text-foreground">
              <li>Copyright, trademark, and other intellectual property laws</li>
              <li>International treaties and conventions</li>
            </ul>
            <p className="mb-4 text-foreground">
              You may not reproduce, distribute, modify, or create derivative works of our Service without explicit written permission.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">6. Data and Privacy</h2>
            <p className="mb-4 text-foreground">
              Your use of the Service is also governed by our Privacy Policy. By using the Service, you consent to:
            </p>
            <ul className="list-disc list-inside space-y-2 mb-4 text-foreground">
              <li>Collection and processing of your data as described in our Privacy Policy</li>
              <li>Use of your domain and company information for analysis purposes</li>
              <li>Storage of analysis results for service improvement</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">7. Disclaimers</h2>
            <p className="mb-4 text-foreground">
              <strong>The Service is provided "as is" and "as available" without any warranties of any kind, either express or implied.</strong>
            </p>
            <ul className="list-disc list-inside space-y-2 mb-4 text-foreground">
              <li>We do not warrant that the Service will be uninterrupted, error-free, or completely secure</li>
              <li>Analysis results are estimates and should not be relied upon as definitive market research</li>
              <li>AI platform responses can change frequently and results may become outdated</li>
              <li>We disclaim all warranties, including merchantability, fitness for a particular purpose, and non-infringement</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">8. Limitation of Liability</h2>
            <p className="mb-4 text-foreground">
              <strong>In no event shall Llumos, Inc. be liable for any indirect, incidental, special, consequential, or punitive damages, 
              including without limitation, loss of profits, data, use, goodwill, or other intangible losses.</strong>
            </p>
            <p className="mb-4 text-foreground">
              Our total liability to you for all damages, losses, and causes of action shall not exceed $100 or the amount 
              you paid us in the last 12 months, whichever is greater.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">9. Indemnification</h2>
            <p className="mb-4 text-foreground">
              You agree to indemnify, defend, and hold harmless Llumos, Inc. and its officers, directors, employees, 
              and agents from any claims, damages, obligations, losses, liabilities, costs, or debt arising from:
            </p>
            <ul className="list-disc list-inside space-y-2 mb-4 text-foreground">
              <li>Your use of the Service</li>
              <li>Your violation of these Terms</li>
              <li>Your violation of any third-party rights</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">10. Termination</h2>
            <p className="mb-4 text-foreground">
              We may terminate or suspend your access to the Service immediately, without prior notice, for any reason, including:
            </p>
            <ul className="list-disc list-inside space-y-2 mb-4 text-foreground">
              <li>Breach of these Terms</li>
              <li>Abuse or misuse of the Service</li>
              <li>Request by law enforcement or other government agencies</li>
            </ul>
            <p className="mb-4 text-foreground">
              Upon termination, your right to use the Service will cease immediately.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">11. Governing Law</h2>
            <p className="mb-4 text-foreground">
              These Terms shall be governed by and construed in accordance with the laws of the State of California, 
              without regard to its conflict of law provisions. Any disputes arising under these Terms shall be resolved 
              in the courts of San Francisco County, California.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">12. Changes to Terms</h2>
            <p className="mb-4 text-foreground">
              We reserve the right to modify these Terms at any time. We will notify you of any material changes by:
            </p>
            <ul className="list-disc list-inside space-y-2 mb-4 text-foreground">
              <li>Posting the updated Terms on this page</li>
              <li>Updating the "Last updated" date</li>
              <li>Sending notice to your email address (if provided)</li>
            </ul>
            <p className="mb-4 text-foreground">
              Your continued use of the Service after any changes constitutes acceptance of the new Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">13. Severability</h2>
            <p className="mb-4 text-foreground">
              If any provision of these Terms is held to be unenforceable or invalid, such provision will be changed 
              and interpreted to accomplish the objectives of such provision to the greatest extent possible under applicable law, 
              and the remaining provisions will continue in full force and effect.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">14. Contact Information</h2>
            <p className="mb-4 text-foreground">
              If you have any questions about these Terms of Service, please contact us at:
            </p>
            <div className="bg-muted/20 p-4 rounded-lg">
              <p className="text-foreground"><strong>Email:</strong> info@llumos.app</p>
              <p className="text-foreground"><strong>Website:</strong> https://llumos.app</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}