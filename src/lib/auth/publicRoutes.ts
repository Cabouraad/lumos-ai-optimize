export const PUBLIC_ROUTES = [
  '/',
  '/free-checker', 
  '/auth',
  '/auth/callback',
  '/auth/processing',
  '/signin',
  '/signup',
  '/pricing',
  '/features',
  '/resources',
  '/privacy',
  '/terms'
];

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.includes(pathname) || pathname.startsWith('/auth/');
}