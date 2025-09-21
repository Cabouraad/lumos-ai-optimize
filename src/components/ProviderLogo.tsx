import { Badge } from '@/components/ui/badge';
import { Bot, Search, Sparkles, Globe } from 'lucide-react';

interface ProviderLogoProps {
  provider: string;
  enabled: boolean;
  size?: 'sm' | 'md' | 'lg';
  showStatus?: boolean;
}

export function ProviderLogo({ provider, enabled, size = 'md', showStatus = true }: ProviderLogoProps) {
  const getProviderConfig = (name: string) => {
    switch (name.toLowerCase()) {
      case 'openai':
        return {
          name: 'OpenAI',
          Icon: Bot,
          bgColor: 'bg-green-100',
          textColor: 'text-green-900'
        };
      case 'perplexity':
        return {
          name: 'Perplexity',
          Icon: Search,
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-900'
        };
      case 'gemini':
        return {
          name: 'Gemini',
          Icon: Sparkles,
          bgColor: 'bg-purple-100',
          textColor: 'text-purple-900'
        };
      case 'google_ai_overview':
        return {
          name: 'Google AIO',
          Icon: Globe,
          bgColor: 'bg-orange-100',
          textColor: 'text-orange-900'
        };
      default:
        return {
          name: name,
          Icon: Bot,
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-900'
        };
    }
  };

  const config = getProviderConfig(provider);
  
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-lg',
    lg: 'w-16 h-16 text-xl'
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  return (
    <div className="flex items-center gap-3">
      <div className={`
        ${sizeClasses[size]} 
        ${config.bgColor} 
        ${config.textColor}
        rounded-xl 
        flex 
        items-center 
        justify-center 
        font-semibold
        shadow-sm
        border
      `}>
        <config.Icon size={size === 'sm' ? 16 : size === 'md' ? 20 : 24} />
      </div>
      
      <div className="flex flex-col">
        <span className={`font-medium ${textSizeClasses[size]}`}>
          {config.name}
        </span>
        {showStatus && (
          <Badge 
            variant={enabled ? "default" : "secondary"} 
            className={`
              w-fit 
              ${size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs'}
              ${enabled 
                ? 'bg-success/10 text-success border-success/20 hover:bg-success/20' 
                : 'bg-muted text-muted-foreground'
              }
            `}
          >
            {enabled ? '✓ Active' : '○ Inactive'}
          </Badge>
        )}
      </div>
    </div>
  );
}