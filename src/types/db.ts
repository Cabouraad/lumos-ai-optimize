export type SubscriberPublic = {
  id: string;
  org_id: string;
  tier: 'starter' | 'growth' | 'pro' | string;
  plan_code: string | null;
  status: string | null;
  period_ends_at: string | null;
  created_at: string;
};