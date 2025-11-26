import zxcvbn from 'zxcvbn';

export interface PasswordStrength {
  score: number; // 0-4 (4 is best)
  feedback: {
    warning: string;
    suggestions: string[];
  };
  crackTimesDisplay: {
    onlineThrottling100PerHour: string;
    onlineNoThrottling10PerSecond: string;
    offlineSlowHashing1e4PerSecond: string;
    offlineFastHashing1e10PerSecond: string;
  };
  isCompromised?: boolean;
  compromisedCount?: number;
}

export const analyzePassword = async (password: string): Promise<PasswordStrength> => {
  const result = zxcvbn(password);
  
  let isCompromised = false;
  let compromisedCount = 0;

  // Check against Have I Been Pwned in background (non-blocking with timeout)
  const hibpCheck = async () => {
    try {
      const sha1 = await digestMessage(password);
      const prefix = sha1.substring(0, 5);
      const suffix = sha1.substring(5).toLowerCase();
      
      // Add 2 second timeout to prevent blocking
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      
      const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        method: 'GET',
        headers: {
          'Add-Padding': 'true' // Privacy enhancement
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const text = await response.text();
        const lines = text.split('\n');
        
        for (const line of lines) {
          const [hashSuffix, count] = line.split(':');
          if (hashSuffix.toLowerCase() === suffix) {
            return { isCompromised: true, compromisedCount: parseInt(count, 10) };
          }
        }
      }
    } catch (error) {
      // Silently fail - don't block on external service
      console.debug('HIBP check failed:', error);
    }
    return { isCompromised: false, compromisedCount: 0 };
  };

  // Start check in background but don't wait for it
  hibpCheck().then(breachData => {
    isCompromised = breachData.isCompromised;
    compromisedCount = breachData.compromisedCount;
  });

  return {
    score: result.score,
    feedback: result.feedback,
    crackTimesDisplay: {
      onlineThrottling100PerHour: String(result.crack_times_display.online_throttling_100_per_hour),
      onlineNoThrottling10PerSecond: String(result.crack_times_display.online_no_throttling_10_per_second),
      offlineSlowHashing1e4PerSecond: String(result.crack_times_display.offline_slow_hashing_1e4_per_second),
      offlineFastHashing1e10PerSecond: String(result.crack_times_display.offline_fast_hashing_1e10_per_second)
    },
    isCompromised,
    compromisedCount
  };
};

// SHA-1 hash for HIBP API (client-side only for k-anonymity)
async function digestMessage(message: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-1', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex.toUpperCase();
}

export const getStrengthLabel = (score: number): string => {
  const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
  return labels[score] || 'Unknown';
};

export const getStrengthColor = (score: number): string => {
  const colors = [
    'hsl(var(--destructive))',
    'hsl(var(--destructive))',
    'hsl(var(--warning) / 0.8)',
    'hsl(var(--primary))',
    'hsl(var(--success))'
  ];
  return colors[score] || 'hsl(var(--muted))';
};