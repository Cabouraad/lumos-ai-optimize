import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptionGate } from '@/hooks/useSubscriptionGate';
import { useBrand } from '@/contexts/BrandContext';
import { useBrands } from '@/hooks/useBrands';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { BrandDisplay } from '@/components/BrandDisplay';
import { BrandSwitcher } from '@/components/BrandSwitcher';
import { HelpTooltip } from '@/components/HelpTooltip';
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
  Beaker,
  TestTube2,
  BookOpen,
  Building2,
  ChevronDown,
  BarChart3,
  HelpCircle
} from 'lucide-react';

export function AppSidebar() {
  const { signOut, orgData, user, subscriptionData } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { canAccessCompetitorAnalysis, canAccessRecommendations } = useSubscriptionGate();
  const { selectedBrand } = useBrand();
  const { brands } = useBrands();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  // Check if user is admin (owner role) and Pro tier
  const isAdmin = user?.user_metadata?.role === 'owner' || orgData?.users?.role === 'owner';
  const isProTier = subscriptionData?.subscription_tier === 'pro';
  const hasMultipleBrands = brands.length > 1;

  const navigation = [
    ...(isProTier ? [{ name: 'Brands', href: '/brands', icon: Building2, tooltip: 'Manage multiple brands and switch between them' }] : []),
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, tooltip: 'Overview of your AI visibility metrics' },
    { name: 'Prompts', href: '/prompts', icon: MessageSquare, tooltip: 'Manage and monitor tracked prompts' },
    { name: 'Competitors', href: '/competitors', icon: Users, tooltip: 'Analyze competitor visibility and performance' },
    { name: 'Citation Analytics', href: '/citation-analytics', icon: BarChart3, tooltip: 'Detailed citation and source analysis' },
    { name: 'Optimizations', href: '/optimizations', icon: Lightbulb, tooltip: 'AI-powered recommendations to improve visibility' },
    { name: 'Reports', href: '/reports', icon: Calendar, tooltip: 'Weekly performance reports and insights' },
    { name: 'LLMs.txt', href: '/llms-txt', icon: FileText, tooltip: 'Configure LLM-specific instructions' },
    { name: 'Settings', href: '/settings', icon: Settings, tooltip: 'Organization and account settings' },
    ...(isAdmin ? [
      { name: 'Labs', href: '/labs', icon: Beaker, tooltip: 'Experimental features and beta testing' },
      { name: 'Tests', href: '/tests', icon: TestTube2, tooltip: 'System diagnostics and testing tools' }
    ] : []),
  ];

  return (
    <Sidebar className="border-r border-border/30 bg-gradient-subtle backdrop-blur-sm shadow-soft">
      <SidebarHeader className="p-6 border-b border-border/30">
        <Logo collapsed={collapsed} />
      </SidebarHeader>
      
      {/* Brand Display with Switcher for Pro users */}
      {selectedBrand ? (
        isProTier && hasMultipleBrands ? (
          <BrandSwitcher brands={brands} collapsed={collapsed} />
        ) : (
          <BrandDisplay brandName={selectedBrand.name} collapsed={collapsed} />
        )
      ) : orgData?.organizations?.name && (
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
                      <Link to={item.href} className="flex items-center justify-between transition-smooth hover-glow w-full">
                        <div className="flex items-center">
                          <Icon className="h-4 w-4" />
                          {!collapsed && <span>{item.name}</span>}
                        </div>
                        {!collapsed && item.tooltip && (
                          <HelpTooltip 
                            content={item.tooltip} 
                            side="right"
                            className="ml-auto"
                          />
                        )}
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
        <div className="space-y-2">
          <Button 
            variant="ghost" 
            asChild
            className="w-full justify-start"
            size={collapsed ? "icon" : "default"}
          >
            <Link to="/user-guide">
              <BookOpen className="h-4 w-4" />
              {!collapsed && <span className="ml-3">User Guide</span>}
            </Link>
          </Button>
          <Button 
            variant="ghost" 
            asChild
            className="w-full justify-start"
            size={collapsed ? "icon" : "default"}
          >
            <a href="https://docs.lovable.dev" target="_blank" rel="noopener noreferrer">
              <HelpCircle className="h-4 w-4" />
              {!collapsed && <span className="ml-3">Help</span>}
            </a>
          </Button>
          <Button 
            variant="outline" 
            onClick={signOut}
            className="w-full justify-start hover-lift border-border/50 hover:border-primary/50"
            size={collapsed ? "icon" : "default"}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span className="ml-3">Sign Out</span>}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}