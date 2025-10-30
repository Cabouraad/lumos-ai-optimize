import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Generate or retrieve session ID
const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem('analytics_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('analytics_session_id', sessionId);
  }
  return sessionId;
};

// Google Analytics helper
const trackGoogleAnalytics = (eventName: string, properties?: Record<string, any>) => {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', eventName, properties);
  }
};

export interface AnalyticsEventProperties {
  [key: string]: any;
}

export function useAnalytics() {
  const { user } = useAuth();
  const sessionIdRef = useRef<string>(getSessionId());

  useEffect(() => {
    // Ensure session ID is set
    sessionIdRef.current = getSessionId();
  }, []);

  const trackEvent = useCallback(
    async (eventName: string, properties?: AnalyticsEventProperties) => {
      try {
        const eventData = {
          event_name: eventName,
          event_properties: properties || {},
          user_id: user?.id || null,
          session_id: sessionIdRef.current,
          page_url: window.location.href,
          referrer: document.referrer || null,
          user_agent: navigator.userAgent,
        };

        // Track in Supabase
        const { error } = await supabase
          .from('analytics_events')
          .insert(eventData);

        if (error) {
          console.error('Analytics tracking error:', error);
        }

        // Track in Google Analytics
        trackGoogleAnalytics(eventName, {
          ...properties,
          user_id: user?.id || 'anonymous',
          session_id: sessionIdRef.current,
        });

        // Track in LinkedIn if conversion event
        if (typeof window !== 'undefined' && (window as any).lintrk) {
          const conversionEvents = ['signup_success', 'signup_begin'];
          if (conversionEvents.includes(eventName)) {
            (window as any).lintrk('track', { conversion_id: eventName });
          }
        }
      } catch (error) {
        // Silent fail - don't break user experience
        console.error('Failed to track event:', error);
      }
    },
    [user]
  );

  // Track specific events with typed helpers
  const trackCtaClick = useCallback(
    (location: string) => {
      trackEvent('cta_hero_click', { location });
    },
    [trackEvent]
  );

  const trackScoreCheck = useCallback(
    (domain: string) => {
      trackEvent('llumos_score_checked', { domain });
    },
    [trackEvent]
  );

  const trackSignupBegin = useCallback(
    (method?: string) => {
      trackEvent('signup_begin', { method: method || 'email' });
    },
    [trackEvent]
  );

  const trackSignupSuccess = useCallback(
    (method?: string) => {
      trackEvent('signup_success', { method: method || 'email' });
    },
    [trackEvent]
  );

  return {
    trackEvent,
    trackCtaClick,
    trackScoreCheck,
    trackSignupBegin,
    trackSignupSuccess,
  };
}
