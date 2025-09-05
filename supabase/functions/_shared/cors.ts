export function cors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const list = (Deno.env.get("APP_ORIGINS") ?? Deno.env.get("APP_ORIGIN") ?? "")
    .split(",").map(s=>s.trim()).filter(Boolean);
  const allowed = list.includes(origin);
  const headers = {
    "Vary": "Origin",
    "Access-Control-Allow-Origin": allowed ? origin : "",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type"
  };
  return { allowed, origin, headers };
}

/**
 * Strict CORS configuration for production security
 */

// Get allowed origins from environment
const getAllowedOrigins = (): string[] => {
  const appOrigin = Deno.env.get('APP_ORIGIN') || 'https://llumos.app';
  const appOrigins = Deno.env.get('APP_ORIGINS');
  
  if (appOrigins) {
    return appOrigins.split(',').map(origin => origin.trim()).filter(Boolean);
  }
  
  // Default origins for development and production
  return [appOrigin, 'http://localhost:5173', 'https://llumos.app'];
};

const ALLOWED_ORIGINS = getAllowedOrigins();

/**
 * Get CORS headers for a specific origin (strict mode)
 */
export function getStrictCorsHeaders(requestOrigin?: string | null): Record<string, string> {
  const origin = requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin) 
    ? requestOrigin 
    : ALLOWED_ORIGINS[0]; // Default to first allowed origin

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
  };
}

/**
 * Legacy CORS headers (permissive - only for backward compatibility)
 * @deprecated Use getStrictCorsHeaders instead
 */
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