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
  // For development environments (localhost, sandbox, and Lovable preview URLs), be more permissive
  const isDevelopment = requestOrigin?.includes('localhost') || 
                       requestOrigin?.includes('sandbox.lovable.dev') ||
                       requestOrigin?.includes('lovable.app') ||
                       requestOrigin?.includes('lovable.dev') ||
                       requestOrigin?.includes('lovableproject.com') ||
                       requestOrigin?.includes('127.0.0.1');
  
  let origin = '*'; // Default permissive for development
  
  if (!isDevelopment) {
    // In production, be strict about origins
    origin = requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin) 
      ? requestOrigin 
      : ALLOWED_ORIGINS[0]; // Default to first allowed origin
  } else if (requestOrigin) {
    // For development, allow the specific origin
    origin = requestOrigin;
  }

  // CRITICAL: Cannot set credentials=true with wildcard origin
  const allowCredentials = origin !== '*';

  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-manual-call, x-cron-secret, x-supabase-api-version',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
    'Vary': 'Origin', // Always include Vary header
  };

  // Only add credentials header when not using wildcard origin
  if (allowCredentials) {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

/**
 * Legacy CORS headers (permissive - for development and backward compatibility)
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-manual-call, x-cron-secret, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
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