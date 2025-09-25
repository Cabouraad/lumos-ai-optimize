/**
 * Usage tracking utilities for quota management
 */

export interface UsageSession {
  orgId: string;
  promptId?: string;
  startTime: number;
  providersRun: string[];
  success: boolean;
}

/**
 * Track usage for a single prompt execution
 */
export class PromptUsageTracker {
  private session: UsageSession;
  private supabase: any;

  constructor(supabase: any, orgId: string, promptId?: string) {
    this.supabase = supabase;
    this.session = {
      orgId,
      promptId,
      startTime: Date.now(),
      providersRun: [],
      success: false
    };
  }

  /**
   * Add a provider to the tracking session
   */
  addProvider(provider: string) {
    if (!this.session.providersRun.includes(provider)) {
      this.session.providersRun.push(provider);
    }
  }

  /**
   * Mark session as successful
   */
  markSuccess() {
    this.session.success = true;
  }

  /**
   * Get current session stats
   */
  getStats() {
    return {
      orgId: this.session.orgId,
      promptId: this.session.promptId,
      duration: Date.now() - this.session.startTime,
      providersCount: this.session.providersRun.length,
      providers: [...this.session.providersRun],
      success: this.session.success
    };
  }

  /**
   * Persist usage to database atomically
   * Only increments if the session was successful
   */
  async persistUsage(): Promise<boolean> {
    if (!this.session.success) {
      console.log('Session not successful, skipping usage persistence');
      return false;
    }

    if (this.session.providersRun.length === 0) {
      console.log('No providers run, skipping usage persistence');
      return false;
    }

    try {
      const { data, error } = await this.supabase.rpc('increment_daily_usage', {
        p_org_id: this.session.orgId,
        p_prompts_increment: 1,
        p_providers_increment: this.session.providersRun.length
      });

      if (error) {
        console.error('Error persisting usage:', error);
        return false;
      }

      const stats = this.getStats();
      console.log('Usage persisted successfully:', {
        orgId: stats.orgId,
        promptId: stats.promptId,
        providersCount: stats.providersCount,
        duration: stats.duration + 'ms'
      });

      return data?.success || false;
    } catch (error: unknown) {
      console.error('Error persisting usage:', error);
      return false;
    }
  }
}

/**
 * Track batch job usage
 */
export class BatchUsageTracker {
  private orgId: string;
  private batchJobId: string;
  private supabase: any;
  private totalPrompts: number = 0;
  private totalProviders: number = 0;
  private successfulPrompts: number = 0;
  private startTime: number;

  constructor(supabase: any, orgId: string, batchJobId: string) {
    this.supabase = supabase;
    this.orgId = orgId;
    this.batchJobId = batchJobId;
    this.startTime = Date.now();
  }

  /**
   * Add a completed task to the tracker
   */
  addCompletedTask(providersRun: number, success: boolean = true) {
    this.totalPrompts += 1;
    this.totalProviders += providersRun;
    
    if (success) {
      this.successfulPrompts += 1;
    }
  }

  /**
   * Get current batch stats
   */
  getStats() {
    return {
      orgId: this.orgId,
      batchJobId: this.batchJobId,
      totalPrompts: this.totalPrompts,
      totalProviders: this.totalProviders,
      successfulPrompts: this.successfulPrompts,
      duration: Date.now() - this.startTime
    };
  }

  /**
   * Persist batch usage to database
   * Only counts successful executions
   */
  async persistBatchUsage(): Promise<boolean> {
    if (this.successfulPrompts === 0) {
      console.log('No successful prompts, skipping batch usage persistence');
      return false;
    }

    try {
      // Calculate usage based on successful executions only
      const avgProvidersPerPrompt = Math.ceil(this.totalProviders * (this.successfulPrompts / this.totalPrompts));
      
      const { data, error } = await this.supabase.rpc('increment_daily_usage', {
        p_org_id: this.orgId,
        p_prompts_increment: this.successfulPrompts,
        p_providers_increment: avgProvidersPerPrompt
      });

      if (error) {
        console.error('Error persisting batch usage:', error);
        return false;
      }

      const stats = this.getStats();
      console.log('Batch usage persisted successfully:', {
        orgId: stats.orgId,
        batchJobId: stats.batchJobId,
        successfulPrompts: stats.successfulPrompts,
        totalProviders: avgProvidersPerPrompt,
        duration: stats.duration + 'ms'
      });

      return data?.success || false;
    } catch (error: unknown) {
      console.error('Error persisting batch usage:', error);
      return false;
    }
  }
}

/**
 * Get current usage stats for an organization
 */
export async function getUsageStats(supabase: any, orgId: string, days: number = 7) {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('daily_usage')
      .select('date, prompts_used, providers_used')
      .eq('org_id', orgId)
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (error) {
      console.error('Error getting usage stats:', error);
      return null;
    }

    const totalPrompts = data.reduce((sum, day) => sum + day.prompts_used, 0);
    const totalProviders = data.reduce((sum, day) => sum + day.providers_used, 0);
    const activeDays = data.filter((day: any) => day.prompts_used > 0).length;

    return {
      dailyData: data,
      summary: {
        totalPrompts,
        totalProviders,
        activeDays,
        avgPromptsPerDay: activeDays > 0 ? Math.round(totalPrompts / activeDays) : 0,
        avgProvidersPerDay: activeDays > 0 ? Math.round(totalProviders / activeDays) : 0
      }
    };
  } catch (error: unknown) {
    console.error('Error getting usage stats:', error);
    return null;
  }
}