import { SEOHead } from '@/components/seo/SEOHead';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, 
  Lock, 
  CheckCircle2, 
  Database, 
  Key, 
  UserCheck, 
  Server, 
  RefreshCw,
  Eye,
  FileCheck,
  Building2,
  ArrowRight
} from 'lucide-react';

export default function Security() {
  return (
    <div className="min-h-screen bg-white">
      <SEOHead
        title="Security & Trust - Llumos"
        description="Enterprise-grade security for your brand data. Learn about our authentication, data protection, and compliance measures."
        canonicalUrl="https://llumos.ai/security"
      />

      {/* Header */}
      <header className="border-b border-gray-100">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl font-bold text-gray-900">Llumos</span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link to="/pricing" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              Pricing
            </Link>
            <Link to="/signin">
              <Button variant="outline" size="sm">Sign In</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <Badge variant="outline" className="mb-6 border-green-200 bg-green-50 text-green-700">
            <Shield className="h-3 w-3 mr-1" />
            Enterprise-Grade Security
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
            Your Brand Data is Safe with Us
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Llumos is built on industry-leading security infrastructure. We protect your competitive intelligence with the same standards used by Fortune 500 companies.
          </p>
        </div>
      </section>

      {/* SOC2 Ready Banner */}
      <section className="py-12 px-4 bg-gray-50 border-y border-gray-100">
        <div className="container mx-auto max-w-4xl">
          <div className="flex flex-col md:flex-row items-center justify-center gap-8">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-green-100">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">SOC2 Ready Architecture</p>
                <p className="text-sm text-gray-500">Built on Supabase infrastructure</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-green-100">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">GDPR Compliant</p>
                <p className="text-sm text-gray-500">EU data protection standards</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-green-100">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">256-bit Encryption</p>
                <p className="text-sm text-gray-500">Data encrypted at rest & in transit</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Authentication Security */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center p-3 rounded-full bg-blue-50 mb-4">
              <Lock className="h-8 w-8 text-blue-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Authentication Security</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              We use enterprise-grade authentication powered by Supabase Auth to protect your account.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <SecurityFeatureCard
              icon={<Key className="h-5 w-5" />}
              title="Supabase Auth"
              description="Industry-standard authentication with secure session management and token-based access control."
            />
            <SecurityFeatureCard
              icon={<UserCheck className="h-5 w-5" />}
              title="Row Level Security (RLS)"
              description="Every database query is validated at the row level. Users can only access data belonging to their organization."
            />
            <SecurityFeatureCard
              icon={<Shield className="h-5 w-5" />}
              title="PKCE Flow"
              description="Proof Key for Code Exchange prevents authorization code interception attacks during OAuth flows."
            />
            <SecurityFeatureCard
              icon={<Lock className="h-5 w-5" />}
              title="Secure Password Storage"
              description="Passwords are hashed using bcrypt with unique salts. We never store plaintext passwords."
            />
            <SecurityFeatureCard
              icon={<RefreshCw className="h-5 w-5" />}
              title="Auto Token Refresh"
              description="Session tokens are automatically refreshed to maintain security without disrupting your workflow."
            />
            <SecurityFeatureCard
              icon={<Eye className="h-5 w-5" />}
              title="Session Monitoring"
              description="All authentication events are logged for security auditing and anomaly detection."
            />
          </div>
        </div>
      </section>

      {/* Data Integrity */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center p-3 rounded-full bg-purple-50 mb-4">
              <Database className="h-8 w-8 text-purple-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Data Integrity</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Your competitive intelligence data is protected with multiple layers of security and redundancy.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <SecurityFeatureCard
              icon={<Server className="h-5 w-5" />}
              title="Daily Automated Backups"
              description="Your data is backed up daily with point-in-time recovery capabilities. Never lose your visibility insights."
              variant="purple"
            />
            <SecurityFeatureCard
              icon={<Shield className="h-5 w-5" />}
              title="Strict RLS Policies"
              description="Every table has Row Level Security policies enforced at the database level, not just the application layer."
              variant="purple"
            />
            <SecurityFeatureCard
              icon={<Lock className="h-5 w-5" />}
              title="Encryption at Rest"
              description="All data is encrypted using AES-256 encryption. Your brand data remains protected even at the storage level."
              variant="purple"
            />
            <SecurityFeatureCard
              icon={<FileCheck className="h-5 w-5" />}
              title="Audit Logging"
              description="Comprehensive audit trails for all data access and modifications. Full visibility into who accessed what and when."
              variant="purple"
            />
          </div>
        </div>
      </section>

      {/* Infrastructure */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center p-3 rounded-full bg-amber-50 mb-4">
              <Building2 className="h-8 w-8 text-amber-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Enterprise Infrastructure</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Built on battle-tested infrastructure trusted by thousands of companies worldwide.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <Card className="border-gray-200 bg-white">
              <CardContent className="pt-6 text-center">
                <div className="text-4xl font-bold text-gray-900 mb-2">99.9%</div>
                <p className="text-gray-600">Uptime SLA</p>
              </CardContent>
            </Card>
            <Card className="border-gray-200 bg-white">
              <CardContent className="pt-6 text-center">
                <div className="text-4xl font-bold text-gray-900 mb-2">AWS</div>
                <p className="text-gray-600">Cloud Infrastructure</p>
              </CardContent>
            </Card>
            <Card className="border-gray-200 bg-white">
              <CardContent className="pt-6 text-center">
                <div className="text-4xl font-bold text-gray-900 mb-2">24/7</div>
                <p className="text-gray-600">Security Monitoring</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gray-900">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Secure Your AI Visibility?
          </h2>
          <p className="text-gray-400 mb-8 max-w-xl mx-auto">
            Join hundreds of brands who trust Llumos with their competitive intelligence data.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/signup">
              <Button size="lg" className="bg-white text-gray-900 hover:bg-gray-100 gap-2">
                Start Free Trial
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/pricing">
              <Button size="lg" variant="outline" className="border-gray-700 text-white hover:bg-gray-800">
                View Enterprise Plans
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-gray-100">
        <div className="container mx-auto max-w-5xl flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} Llumos. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link to="/privacy" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

interface SecurityFeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  variant?: 'blue' | 'purple';
}

function SecurityFeatureCard({ icon, title, description, variant = 'blue' }: SecurityFeatureCardProps) {
  const iconBgClass = variant === 'purple' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600';
  
  return (
    <Card className="border-gray-200 bg-white hover:shadow-md transition-shadow">
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className={`p-2 rounded-lg ${iconBgClass}`}>
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
            <p className="text-sm text-gray-600">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
