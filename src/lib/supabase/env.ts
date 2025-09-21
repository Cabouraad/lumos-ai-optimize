export function getBrowserEnv() {
  // Support both Next.js and Vite environment variable formats
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!url || !anon) {
    throw new Error(
      'Supabase browser env missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.'
    );
  }
  
  if (!/^https:\/\//.test(url)) {
    console.warn('Supabase URL is not https:// — mixed content may block requests in production.');
  }
  
  return { url, anon };
}