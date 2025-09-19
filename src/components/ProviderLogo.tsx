import { Badge } from '@/components/ui/badge';

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
          logo: '🤖',
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-900'
        };
      case 'perplexity':
        return {
          name: 'Perplexity',
          logo: '🔍',
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-900'
        };
      case 'gemini':
        return {
          name: 'Gemini',
          logo: '✨',
          bgColor: 'bg-purple-100',
          textColor: 'text-purple-900'
        };
      case 'google_ai_overview':
        return {
          name: 'Google AIO',
          logo: '🔎',
          bgColor: 'bg-orange-100',
          textColor: 'text-orange-900'
        };
      default:
        return {
          name: name,
          logo: '🔗',
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
        {config.logo}
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