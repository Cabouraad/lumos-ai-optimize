/**
 * Comprehensive quota enforcement system
 * Handles plan entitlements, usage tracking, and structured error responses
 */

export type PlanTier = 'starter' | 'growth' | 'pro' | 'free';

export interface TierQuotas {
  promptsPerDay: number;
  providersPerPrompt: number;
}

export interface QuotaCheckResult {
  allowed: boolean;
  error?: {
    code: string;
    message: string;
    details: {
      used: number;
      limit: number;
      tier: string;
      resetsAt: string;
    };
  };
}

export interface UsageData {
  promptsUsed: number;
  providersUsed: number;
}

/**
 * Get quota limits for a plan tier
 * ALIGNED WITH PRICING PAGE:
 * - Starter: 25 prompts/day, 2 providers
 * - Growth: 100 prompts/day, 4 providers
 * - Pro: 300 prompts/day, 4 providers
 */
export function getQuotasForTier(planTier: PlanTier): TierQuotas {
  switch (planTier) {
    case 'starter':
      return { promptsPerDay: 25, providersPerPrompt: 2 };
    case 'growth':
      return { promptsPerDay: 100, providersPerPrompt: 4 };
    case 'pro':
      return { promptsPerDay: 300, providersPerPrompt: 4 };
    case 'free':
      return { promptsPerDay: 5, providersPerPrompt: 1 };
    default:
      return { promptsPerDay: 5, providersPerPrompt: 1 }; // Default to free tier
  }
}

/**
 * Get subscription and quota information for an organization
 */
export async function getOrgQuotaInfo(supabase: any, userId: string, orgId: string) {
  // Get subscription info
  const { data: subscriber } = await supabase
    .from('subscribers')
    .select('subscribed, subscription_tier, trial_expires_at, payment_collected')
    .eq('user_id', userId)
    .maybeSingle();

  if (!subscriber) {
    return {
      tier: 'starter' as PlanTier,
      quotas: getQuotasForTier('starter'),
      hasAccess: false,
      reason: 'No subscription found'
    };
  }

  // Check if trial expired
  const isOnTrial = subscriber.subscription_tier === 'starter' && subscriber.trial_expires_at;
  const trialExpired = isOnTrial && new Date() > new Date(subscriber.trial_expires_at);
  
  // Check if has access
  const hasAccess = !trialExpired && (subscriber.subscribed || isOnTrial);
  
  const tier = (subscriber.subscription_tier || 'starter') as PlanTier;
  const quotas = getQuotasForTier(tier);

  return {
    tier,
    quotas,
    hasAccess,
    reason: !hasAccess ? 'Subscription required to run prompts' : undefined,
    subscriber
  };
}

/**
 * Get current daily usage for an organization
 */
export async function getDailyUsage(supabase: any, orgId: string, date?: string): Promise<UsageData> {
  const targetDate = date || new Date().toISOString().split('T')[0];
  
  const { data } = await supabase.rpc('get_daily_usage', {
    p_org_id: orgId,
    p_date: targetDate
  });

  if (data && data.length > 0) {
    return {
      promptsUsed: data[0].prompts_used || 0,
      providersUsed: data[0].providers_used || 0
    };
  }

  return { promptsUsed: 0, providersUsed: 0 };
}

/**
 * Check if a prompt execution is within quota limits
 */
export async function checkPromptQuota(
  supabase: any, 
  userId: string, 
  orgId: string, 
  providersToRun: number = 1
): Promise<QuotaCheckResult> {
  try {
    // Get quota info
    const quotaInfo = await getOrgQuotaInfo(supabase, userId, orgId);
    
    if (!quotaInfo.hasAccess) {
      return {
        allowed: false,
        error: {
          code: 'subscription_required',
          message: quotaInfo.reason || 'Subscription required',
          details: {
            used: 0,
            limit: 0,
            tier: quotaInfo.tier,
            resetsAt: getNextResetTime()
          }
        }
      };
    }

    // Get current usage
    const usage = await getDailyUsage(supabase, orgId);
    
    // Check prompt quota
    if (usage.promptsUsed >= quotaInfo.quotas.promptsPerDay) {
      return {
        allowed: false,
        error: {
          code: 'quota_exceeded',
          message: `Daily prompt quota exceeded (${quotaInfo.quotas.promptsPerDay} prompts per day)`,
          details: {
            used: usage.promptsUsed,
            limit: quotaInfo.quotas.promptsPerDay,
            tier: quotaInfo.tier,
            resetsAt: getNextResetTime()
          }
        }
      };
    }

    // Check providers per prompt quota
    if (providersToRun > quotaInfo.quotas.providersPerPrompt) {
      return {
        allowed: false,
        error: {
          code: 'providers_exceeded',
          message: `Too many providers requested (max ${quotaInfo.quotas.providersPerPrompt} per prompt)`,
          details: {
            used: providersToRun,
            limit: quotaInfo.quotas.providersPerPrompt,
            tier: quotaInfo.tier,
            resetsAt: getNextResetTime()
          }
        }
      };
    }

    return { allowed: true };

  } catch (error: unknown) {
    console.error('Error checking quota:', error);
    return {
      allowed: false,
      error: {
        code: 'quota_check_failed',
        message: 'Failed to verify quota limits',
        details: {
          used: 0,
          limit: 0,
          tier: 'starter',
          resetsAt: getNextResetTime()
        }
      }
    };
  }
}

/**
 * Increment usage counters atomically
 */
export async function incrementUsage(
  supabase: any,
  orgId: string,
  promptsIncrement: number = 1,
  providersIncrement: number = 1
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('increment_daily_usage', {
      p_org_id: orgId,
      p_prompts_increment: promptsIncrement,
      p_providers_increment: providersIncrement
    });

    if (error) {
      console.error('Error incrementing usage:', error);
      return false;
    }

    return data?.success || false;
  } catch (error: unknown) {
    console.error('Error incrementing usage:', error);
    return false;
  }
}

/**
 * Create structured quota exceeded response
 */
export function createQuotaExceededResponse(quotaResult: QuotaCheckResult): Response {
  if (!quotaResult.error) {
    throw new Error('No error in quota result');
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': (globalThis as any).Deno?.env?.get?.("APP_ORIGIN") ?? "https://llumos.app",
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  return new Response(
    JSON.stringify({
      error: quotaResult.error.message,
      code: quotaResult.error.code,
      details: quotaResult.error.details,
      timestamp: new Date().toISOString()
    }),
    { 
      status: 429,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Retry-After': '86400' // Retry after 24 hours (daily quota reset)
      }
    }
  );
}

/**
 * Get next quota reset time (midnight UTC)
 */
function getNextResetTime(): string {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return tomorrow.toISOString();
}