import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { FAQ } from '@/components/FAQ';
import { 
  LayoutDashboard, 
  MessageSquare,
  Users, 
  FileText,
  Lightbulb, 
  Settings,
  LogOut
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { signOut, orgData } = useAuth();
  const location = useLocation();

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
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-card border-r border-border flex flex-col h-screen">
          <div className="p-6">
            <h1 className="text-xl font-bold text-foreground">Llumos</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {orgData?.organizations?.name}
            </p>
          </div>
          
          <nav className="px-3 flex-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium mb-1 transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                >
                  <Icon className="mr-3 h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="p-3 border-t border-border">
            <Button 
              variant="outline" 
              onClick={signOut}
              className="w-full justify-start"
            >
              <LogOut className="mr-3 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1">
          {/* Top bar with FAQ */}
          {showFAQ && (
            <div className="flex justify-end p-4 pb-0">
              <FAQ page={location.pathname} />
            </div>
          )}
          
          <main className={`p-8 ${showFAQ ? 'pt-4' : ''}`}>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}