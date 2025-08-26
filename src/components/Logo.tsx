import { Link } from 'react-router-dom';
import { Search, Eye } from 'lucide-react';

interface LogoProps {
  collapsed?: boolean;
}

export function Logo({ collapsed = false }: LogoProps) {
  return (
    <Link 
      to="/dashboard" 
      className="flex items-center gap-3 group hover-lift transition-smooth"
    >
      {/* Logo Icon - Magnifying glass with a subtle glow effect */}
      <div className="relative">
        <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary-glow rounded-lg flex items-center justify-center shadow-glow group-hover:shadow-[0_0_20px_hsl(var(--primary)/0.5)] transition-all duration-300">
          <Search className="w-4 h-4 text-white" strokeWidth={2.5} />
        </div>
        {/* Small accent dot for extra visual interest */}
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full opacity-80 group-hover:opacity-100 transition-opacity"></div>
      </div>
      
      {/* Logo Text */}
      {!collapsed && (
        <div className="flex flex-col">
          <h1 className="text-xl font-display font-bold gradient-primary bg-clip-text text-transparent group-hover:scale-105 transition-transform">
            Llumos
          </h1>
          <span className="text-xs text-muted-foreground font-medium tracking-wider opacity-60">
            AI INSIGHTS
          </span>
        </div>
      )}
    </Link>
  );
}