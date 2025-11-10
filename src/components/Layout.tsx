import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { ThemeToggle } from '@/components/ThemeToggle';
import { FAQ } from '@/components/FAQ';
import { AppSidebar } from '@/components/AppSidebar';
import { HelpTooltip } from '@/components/HelpTooltip';
import { 
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();

  // Pages that should show the FAQ button
  const pagesWithFAQ = ['/prompts', '/competitors', '/llms-txt', '/optimizations'];
  const showFAQ = pagesWithFAQ.includes(location.pathname);

  return (
    <SidebarProvider>
      <div className="min-h-screen w-full flex bg-gradient-bg">
        <AppSidebar />
        
        <SidebarInset className="flex-1">
          {/* Top bar with trigger, FAQ and Theme Toggle */}
          <div className="flex justify-between items-center p-4 pb-0 bg-card/30 backdrop-blur-sm border-b border-border/30">
            <SidebarTrigger className="ml-0" />
            <div className="flex items-center gap-2">
              <ThemeToggle />
              {showFAQ && <FAQ page={location.pathname} />}
            </div>
          </div>
          
          <main className="p-8 pt-6 bg-gradient-subtle min-h-screen">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}