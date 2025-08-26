import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { FAQ } from '@/components/FAQ';
import { 
  LayoutDashboard, 
  MessageSquare,
  Users, 
  FileText,
  Lightbulb, 
  Settings,
  LogOut,
  Crown
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { signOut, orgData } = useAuth();
  const location = useLocation();
  const { canAccessCompetitorAnalysis, canAccessRecommendations } = useSubscriptionGate();

  // Pages that should show the FAQ button
  const pagesWithFAQ = ['/prompts', '/competitors', '/llms-txt', '/recommendations'];
  const showFAQ = pagesWithFAQ.includes(location.pathname);

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Prompts', href: '/prompts', icon: MessageSquare },
    { name: 'Competitors', href: '/competitors', icon: Users },
    { name: 'LLMs.txt', href: '/llms-txt', icon: FileText },
    { name: 'Recommendations', href: '/recommendations', icon: Lightbulb },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gradient-bg">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-card/95 backdrop-blur-sm border-r border-border shadow-soft flex flex-col h-screen">
          <div className="p-6 border-b border-border/50">
            <h1 className="text-xl font-display gradient-primary bg-clip-text text-transparent">
              Llumos
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {orgData?.organizations?.name}
            </p>
          </div>
          
          <nav className="px-3 flex-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              
              // Check if this feature is restricted
              const isRestricted = 
                (item.href === '/competitors' && !canAccessCompetitorAnalysis().hasAccess) ||
                (item.href === '/recommendations' && !canAccessRecommendations().hasAccess);
              
              if (isRestricted) {
                return (
                  <div key={item.name} className="relative mb-1">
                    <div className={`flex items-center px-3 py-2 pr-10 rounded-md text-sm font-medium opacity-50 cursor-not-allowed text-muted-foreground`}>
                      <Icon className="mr-3 h-4 w-4" />
                      {item.name}
                    </div>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 p-0 pointer-events-auto"
                      onClick={(e) => { e.stopPropagation(); window.location.href = '/pricing'; }}
                      aria-label="Upgrade plan"
                      title="Upgrade plan"
                    >
                      <Crown className="h-3 w-3" />
                    </Button>
                  </div>
                );
              }
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                   className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium mb-1 transition-smooth hover-glow ${
                     isActive
                       ? 'bg-primary text-primary-foreground shadow-glow'
                       : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                   }`}
                >
                  <Icon className="mr-3 h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="p-3 border-t border-border/50">
            <Button 
              variant="outline" 
              onClick={signOut}
              className="w-full justify-start hover-lift border-border/50 hover:border-primary/50"
            >
              <LogOut className="mr-3 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 bg-gradient-subtle">
          {/* Top bar with FAQ and Theme Toggle */}
          <div className="flex justify-between items-center p-4 pb-0 bg-card/30 backdrop-blur-sm border-b border-border/30">
            <div></div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              {showFAQ && <FAQ page={location.pathname} />}
            </div>
          </div>
          
          <main className="p-8 pt-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}