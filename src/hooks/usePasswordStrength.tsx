import { useState, useEffect } from 'react';
import { analyzePassword, type PasswordStrength } from '@/lib/security/passwordStrength';

export const usePasswordStrength = (password: string) => {
  const [strength, setStrength] = useState<PasswordStrength | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!password || password.length === 0) {
      setStrength(null);
      return;
    }

    if (password.length < 6) {
      setStrength({
        score: 0,
        feedback: {
          warning: 'Password is too short',
          suggestions: ['Use at least 6 characters']
        },
        crackTimesDisplay: {
          onlineThrottling100PerHour: 'instant',
          onlineNoThrottling10PerSecond: 'instant',
          offlineSlowHashing1e4PerSecond: 'instant',
          offlineFastHashing1e10PerSecond: 'instant'
        }
      });
      return;
    }

    const analyzePasswordAsync = async () => {
      try {
        // Quick local analysis (non-blocking)
        const result = await analyzePassword(password);
        setStrength(result);
      } catch (error) {
        console.error('Password analysis failed:', error);
        // Fallback to basic analysis
        setStrength({
          score: password.length >= 12 ? 2 : 1,
          feedback: {
            warning: '',
            suggestions: password.length < 12 ? ['Use at least 12 characters'] : []
          },
          crackTimesDisplay: {
            onlineThrottling100PerHour: 'unknown',
            onlineNoThrottling10PerSecond: 'unknown',
            offlineSlowHashing1e4PerSecond: 'unknown',
            offlineFastHashing1e10PerSecond: 'unknown'
          }
        });
      }
    };

    // Debounce the analysis but don't show loading state
    const timeoutId = setTimeout(analyzePasswordAsync, 300);
    return () => clearTimeout(timeoutId);
  }, [password]);

  return { strength, loading };
};