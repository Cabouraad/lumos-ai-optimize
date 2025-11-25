/**
 * Performance monitoring utilities
 * Lightweight helpers for tracking key metrics
 */

interface PerformanceMark {
  startTime: number;
  name: string;
}

const marks = new Map<string, PerformanceMark>();

/**
 * Start a performance measurement
 */
export function markStart(name: string): void {
  marks.set(name, {
    startTime: performance.now(),
    name,
  });
}

/**
 * End a performance measurement and log if over threshold
 */
export function markEnd(name: string, warnThresholdMs: number = 100): number {
  const mark = marks.get(name);
  if (!mark) return 0;

  const duration = performance.now() - mark.startTime;
  marks.delete(name);

  if (duration > warnThresholdMs) {
    console.warn(`[Performance] ${name} took ${duration.toFixed(2)}ms`);
  }

  return duration;
}

/**
 * Measure a function execution time
 */
export async function measure<T>(
  name: string,
  fn: () => T | Promise<T>,
  warnThresholdMs: number = 100
): Promise<T> {
  markStart(name);
  try {
    const result = await fn();
    markEnd(name, warnThresholdMs);
    return result;
  } catch (error) {
    markEnd(name, warnThresholdMs);
    throw error;
  }
}

/**
 * Log Web Vitals when available
 * Now enabled in production for performance monitoring
 */
export function observeWebVitals(): void {
  if (typeof window === 'undefined') return;

  const isDev = import.meta.env.DEV;

  // CLS - Cumulative Layout Shift
  if ('PerformanceObserver' in window) {
    try {
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if ((entry as any).hadRecentInput) continue;
          const value = (entry as any).value;
          
          // Log in development, report in production
          if (isDev) {
            console.debug('[WebVitals] CLS:', value);
          }
          
          // In production, could send to analytics service
          if (!isDev && value > 0.1) {
            // CLS above threshold - could report to monitoring service
            console.warn('[WebVitals] High CLS detected:', value);
          }
        }
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
    } catch (e) {
      // Observer not supported
    }
  }

  // Log page load time
  window.addEventListener('load', () => {
    const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (perfData) {
      const metrics = {
        dns: perfData.domainLookupEnd - perfData.domainLookupStart,
        tcp: perfData.connectEnd - perfData.connectStart,
        ttfb: perfData.responseStart - perfData.requestStart,
        domLoad: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
        total: perfData.loadEventEnd - perfData.fetchStart,
      };
      
      if (isDev) {
        console.debug('[WebVitals] Page Load:', metrics);
      }
      
      // In production, log slow loads
      if (!isDev && metrics.total > 3000) {
        console.warn('[WebVitals] Slow page load:', metrics);
      }
    }
  });
}
