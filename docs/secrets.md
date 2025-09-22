# Environment Variables & Secrets

## Browser Environment Variables

The browser client requires these environment variables:

- `VITE_SUPABASE_URL` - Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anon/public key

## Local Development

Create a `.env` file in the project root (never commit this):

```bash
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key-here"
```

## Production Deployment

Set these as environment variables in your hosting platform (Lovable, Vercel, etc.).

## Security Notes

- The `.env` file is git-ignored to prevent accidental commits
- Only the anon/public key should be in browser code
- Service role keys should never be exposed to the browser
- Use Supabase Edge Functions for server-side operations that require the service role key

## Key Rotation

If keys are accidentally exposed:
1. Rotate them in the Supabase dashboard (Settings → API)
2. Update all deployment environments
3. Clear browser caches if needed