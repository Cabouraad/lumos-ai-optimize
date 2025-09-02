const ORIGIN = '*';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting utilities
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function isRateLimited(ip: string, maxRequests = 60, windowMs = 60000): boolean {
  const now = Date.now();
  const key = ip;
  const existing = rateLimitStore.get(key);
  
  if (!existing || now > existing.resetTime) {
    // New window or expired window
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return false;
  }
  
  if (existing.count >= maxRequests) {
    return true;
  }
  
  existing.count++;
  return false;
}

export function getRateLimitHeaders(ip: string, maxRequests = 60, windowMs = 60000) {
  const existing = rateLimitStore.get(ip);
  const remaining = existing ? Math.max(0, maxRequests - existing.count) : maxRequests;
  const resetTime = existing ? existing.resetTime : Date.now() + windowMs;
  
  return {
    'X-RateLimit-Limit': maxRequests.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(resetTime / 1000).toString(),
  };
}