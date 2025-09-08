import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { BrandDisplay } from '@/components/BrandDisplay';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { 
  LayoutDashboard, 
  MessageSquare,
  Users, 
  FileText,
  Lightbulb, 
  Settings,
  LogOut,
  Crown,
  Calendar,
  Beaker
} from 'lucide-react';

export function AppSidebar() {
  const { signOut, orgData, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { canAccessCompetitorAnalysis, canAccessRecommendations } = useSubscriptionGate();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  // Check if user is admin (owner role)
  const isAdmin = user?.user_metadata?.role === 'owner' || orgData?.users?.role === 'owner';

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Prompts', href: '/prompts', icon: MessageSquare },
    { name: 'Competitors', href: '/competitors', icon: Users },
    { name: 'LLMs.txt', href: '/llms-txt', icon: FileText },
    { name: 'Optimizations', href: '/optimizations', icon: Lightbulb },
    { name: 'Reports', href: '/reports', icon: Calendar },
    { name: 'Settings', href: '/settings', icon: Settings },
    ...(isAdmin ? [{ name: 'Labs', href: '/labs', icon: Beaker }] : []),
  ];

  return (
    <Sidebar className="border-r border-border/30 bg-gradient-subtle backdrop-blur-sm shadow-soft">
      <SidebarHeader className="p-6 border-b border-border/30">
        <Logo collapsed={collapsed} />
      </SidebarHeader>
      
      {/* Brand Display */}
      {orgData?.organizations?.name && (
        <BrandDisplay 
          brandName={orgData.organizations.name} 
          collapsed={collapsed}
        />
      )}
      
      <SidebarContent className="px-3">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                
                // Check if this feature is restricted
                const isRestricted = 
                  (item.href === '/competitors' && !canAccessCompetitorAnalysis().hasAccess) ||
                  (item.href === '/optimizations' && !canAccessRecommendations().hasAccess) ||
                  (item.href === '/reports' && !canAccessRecommendations().hasAccess);
                
                if (isRestricted) {
                  return (
                    <SidebarMenuItem key={item.name} className="relative">
                      <SidebarMenuButton 
                        disabled
                        className="opacity-50 cursor-not-allowed"
                      >
                        <Icon className="h-4 w-4" />
                        {!collapsed && <span>{item.name}</span>}
                      </SidebarMenuButton>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 p-0"
                        onClick={(e) => { e.stopPropagation(); navigate('/pricing'); }}
                        aria-label="Upgrade plan"
                        title="Upgrade plan"
                      >
                        <Crown className="h-3 w-3" />
                      </Button>
                    </SidebarMenuItem>
                  );
                }
                
                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link to={item.href} className="flex items-center transition-smooth hover-glow">
                        <Icon className="h-4 w-4" />
                        {!collapsed && <span>{item.name}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-border/30 mt-auto">
        <Button 
          variant="outline" 
          onClick={signOut}
          className="w-full justify-start hover-lift border-border/50 hover:border-primary/50"
          size={collapsed ? "icon" : "default"}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-3">Sign Out</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}