# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/452116ea-eab3-4645-9f1c-4fbaa7334a8d

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/452116ea-eab3-4645-9f1c-4fbaa7334a8d) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Set up environment variables.
cp .env.local.example .env.local
# Edit .env.local with your Supabase project details

# Step 5: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Supabase (Authentication & Database)

## Environment Setup

Copy the example environment file and configure your Supabase credentials:

```sh
cp .env.local.example .env.local
```

Then edit `.env.local` with your Supabase project details:
- `VITE_SUPABASE_PROJECT_ID`: Your Supabase project ID
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Your Supabase publishable anon key

**⚠️ Security Note**: Never commit `.env.local` to version control. It's gitignored by default.

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/452116ea-eab3-4645-9f1c-4fbaa7334a8d) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

## Development & Testing

### Running Tests

```sh
# Run unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run smoke tests (requires environment setup)
node scripts/smoke-test.mjs

# Seed development data
npx tsx scripts/seed.ts
```

### Acceptance Testing Checklist

After deploying the application, run through this manual checklist:

**1. Organization Setup**
- [ ] Create organization and login as owner
- [ ] Verify user can access all authenticated pages
- [ ] Confirm organization data appears correctly

**2. Domain Verification**
- [ ] Enter domain in Settings page
- [ ] Place verification file at `https://yourdomain/.well-known/llumos-verify.txt` with the provided token
- [ ] Click "Verify domain" button
- [ ] Confirm `domain_locked_at` is set in database
- [ ] Verify domain becomes read-only in Settings

**3. Provider & Prompt Testing**
- [ ] Toggle LLM providers (OpenAI/Perplexity) in Settings
- [ ] Add a test prompt in Prompts page
- [ ] Click "Run now" on the prompt
- [ ] Verify prompt run appears in table with status and score
- [ ] Check Dashboard shows updated aggregate score

**4. Daily Automation**
- [ ] Manually trigger daily-run Edge Function
- [ ] Confirm quotas are respected (Starter: 10 prompts × 2 providers/day)
- [ ] Verify no quota overruns occur
- [ ] Check function logs for any errors

**5. Recommendations System**
- [ ] Navigate to Recommendations page
- [ ] Verify recommendations appear for low/absent prompts
- [ ] Test "Mark Done" and "Ignore" actions
- [ ] Confirm recommendations are grouped by type

**6. Row Level Security (RLS)**
- [ ] Create second test organization
- [ ] Attempt to access first org's data while logged in as second org
- [ ] Confirm access is properly denied (should fail)
- [ ] Verify cross-organization data isolation

**7. Dashboard Metrics**
- [ ] Check Today's Aggregate Score displays correctly
- [ ] Verify 7-day sparkline shows trend data
- [ ] Confirm top missing prompts and competitors appear
- [ ] Check Health panel shows provider status and token usage

**8. Error Handling**
- [ ] Test with invalid API keys
- [ ] Verify graceful failure and error messages
- [ ] Check Edge Function timeout handling (15s limit)
- [ ] Confirm retry logic works for network errors

All items should pass before considering the deployment successful.

## RLS Hardening Notes

- `users` table: read-only for clients; writes are service-role via the onboarding function.
- `organizations` insert: service-role only (trigger); updates: owner policy.
- Never reference `users` inside a `users` policy (recursion). See scripts/check-policies.sql.
- Onboarding must call the Edge Function `/functions/v1/onboarding` with the user's JWT; the function uses `SUPABASE_SERVICE_ROLE_KEY`.
