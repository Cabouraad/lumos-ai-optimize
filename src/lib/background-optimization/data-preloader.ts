/**
 * Phase 3: Background Data Pre-loading and Performance Optimization
 */

import { supabase } from "@/integrations/supabase/client";
import { advancedCache } from "../advanced-cache/redis-cache";
import { getOrgId } from "../auth";

interface PreloadJob {
  id: string;
  type: 'dashboard' | 'prompts' | 'competitors' | 'recommendations';
  priority: 'high' | 'medium' | 'low';
  scheduledAt: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  estimatedDuration: number;
}

class BackgroundDataPreloader {
  private jobs: Map<string, PreloadJob> = new Map();
  private isProcessing = false;
  private processingQueue: string[] = [];
  private worker: Worker | null = null;

  constructor() {
    this.initializeWorker();
    this.scheduleRegularPreloads();
  }

  /**
   * Schedule high-priority data preloading for critical user paths
   */
  preloadCriticalData(): void {
    this.addJob({
      id: `dashboard-${Date.now()}`,
      type: 'dashboard',
      priority: 'high',
      scheduledAt: Date.now(),
      status: 'pending',
      estimatedDuration: 2000
    });

    this.addJob({
      id: `prompts-${Date.now()}`,
      type: 'prompts', 
      priority: 'high',
      scheduledAt: Date.now() + 500, // Slight delay to avoid overwhelming
      status: 'pending',
      estimatedDuration: 1500
    });
  }

  /**
   * Preload data for specific user interactions
   */
  preloadForUserIntent(intent: 'viewing-competitors' | 'checking-recommendations' | 'analyzing-prompts'): void {
    switch (intent) {
      case 'viewing-competitors':
        this.addJob({
          id: `competitors-${Date.now()}`,
          type: 'competitors',
          priority: 'medium',
          scheduledAt: Date.now(),
          status: 'pending',
          estimatedDuration: 1000
        });
        break;
      
      case 'checking-recommendations':
        this.addJob({
          id: `recommendations-${Date.now()}`,
          type: 'recommendations',
          priority: 'medium',
          scheduledAt: Date.now(),
          status: 'pending',
          estimatedDuration: 800
        });
        break;
      
      case 'analyzing-prompts':
        this.preloadCriticalData(); // Prompts need dashboard context
        break;
    }
  }

  /**
   * Intelligent cache warming based on user behavior patterns
   */
  warmCacheIntelligently(userActivity: {
    lastVisitedPages: string[];
    frequentActions: string[];
    timeOfDay: number;
  }): void {
    const { lastVisitedPages, frequentActions, timeOfDay } = userActivity;
    
    // Morning users typically check dashboard first
    if (timeOfDay >= 6 && timeOfDay <= 10) {
      this.preloadCriticalData();
    }
    
    // If user frequently views competitors, preload that data
    if (frequentActions.includes('view-competitors')) {
      this.preloadForUserIntent('viewing-competitors');
    }
    
    // If user was recently on prompts page, likely to return
    if (lastVisitedPages.includes('/prompts')) {
      this.addJob({
        id: `prompts-return-${Date.now()}`,
        type: 'prompts',
        priority: 'low',
        scheduledAt: Date.now() + 30000, // 30 seconds delay
        status: 'pending',
        estimatedDuration: 1500
      });
    }
  }

  private addJob(job: PreloadJob): void {
    this.jobs.set(job.id, job);
    this.processingQueue.push(job.id);
    
    if (!this.isProcessing) {
      this.processNextJob();
    }
  }

  private async processNextJob(): Promise<void> {
    if (this.processingQueue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    const jobId = this.processingQueue.shift()!;
    const job = this.jobs.get(jobId);
    
    if (!job) {
      this.processNextJob();
      return;
    }

    try {
      job.status = 'running';
      await this.executeJob(job);
      job.status = 'completed';
    } catch (error) {
      console.error(`Preload job ${jobId} failed:`, error);
      job.status = 'failed';
    }

    // Continue processing queue
    setTimeout(() => this.processNextJob(), 100);
  }

  private async executeJob(job: PreloadJob): Promise<void> {
    const orgId = await getOrgId();
    
    switch (job.type) {
      case 'dashboard':
        await this.preloadDashboardData(orgId);
        break;
      
      case 'prompts':
        await this.preloadPromptsData(orgId);
        break;
      
      case 'competitors':
        await this.preloadCompetitorsData(orgId);
        break;
      
      case 'recommendations':
        await this.preloadRecommendationsData(orgId);
        break;
    }
  }

  private async preloadDashboardData(orgId: string): Promise<void> {
    const cacheKey = `dashboard-data-${orgId}`;
    
    // Check if already cached
    const cached = await advancedCache.get(cacheKey);
    if (cached) return;

    // Fetch recent performance data from latest responses
    const { data: metrics } = await supabase
      .from('latest_prompt_provider_responses')
      .select('*')
      .eq('org_id', orgId)
      .limit(50);

    if (metrics) {
      advancedCache.set(cacheKey, metrics, 120000); // 2 minute cache
    }

    // Preload recent prompt runs
    const { data: recentRuns } = await supabase
      .from('prompt_provider_responses')
      .select(`
        id, prompt_id, provider, score, org_brand_present, 
        competitors_count, run_at, status
      `)
      .eq('org_id', orgId)
      .eq('status', 'success')
      .order('run_at', { ascending: false })
      .limit(20);

    if (recentRuns) {
      advancedCache.set(`recent-runs-${orgId}`, recentRuns, 180000);
    }
  }

  private async preloadPromptsData(orgId: string): Promise<void> {
    const cacheKey = `prompts-data-${orgId}`;
    
    const cached = await advancedCache.get(cacheKey);
    if (cached) return;

    // Fetch prompts with latest scores
    const { data: prompts } = await supabase
      .from('prompts')
      .select(`
        id, text, active, created_at,
        latest_prompt_provider_responses (
          provider, score, org_brand_present, 
          competitors_count, run_at
        )
      `)
      .eq('org_id', orgId)
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (prompts) {
      advancedCache.set(cacheKey, prompts, 300000); // 5 minute cache
    }
  }

  private async preloadCompetitorsData(orgId: string): Promise<void> {
    const cacheKey = `competitors-data-${orgId}`;
    
    const cached = await advancedCache.get(cacheKey);
    if (cached) return;

    const { data: competitors } = await supabase
      .from('brand_catalog')
      .select('*')
      .eq('org_id', orgId)
      .eq('is_org_brand', false)
      .order('total_appearances', { ascending: false })
      .limit(50);

    if (competitors) {
      advancedCache.set(cacheKey, competitors, 600000); // 10 minute cache
    }
  }

  private async preloadRecommendationsData(orgId: string): Promise<void> {
    const cacheKey = `recommendations-data-${orgId}`;
    
    const cached = await advancedCache.get(cacheKey);
    if (cached) return;

    const { data: recommendations } = await supabase
      .from('recommendations')
      .select('*')
      .eq('org_id', orgId)
      .in('status', ['open', 'snoozed'])
      .order('created_at', { ascending: false })
      .limit(20);

    if (recommendations) {
      advancedCache.set(cacheKey, recommendations, 240000); // 4 minute cache
    }
  }

  private initializeWorker(): void {
    // In a real implementation, this would create a Web Worker for background processing
    // For now, we'll use setTimeout to simulate background processing
    console.log('Background preloader initialized');
  }

  private scheduleRegularPreloads(): void {
    // Schedule preloads every 5 minutes for active users
    setInterval(() => {
      const now = Date.now();
      const lastActivity = localStorage.getItem('lastUserActivity');
      
      if (lastActivity && (now - parseInt(lastActivity)) < 300000) { // 5 minutes
        this.preloadCriticalData();
      }
    }, 300000); // 5 minutes
  }

  /**
   * Get preloading statistics for monitoring
   */
  getStats() {
    const totalJobs = this.jobs.size;
    const completedJobs = Array.from(this.jobs.values()).filter(j => j.status === 'completed').length;
    const failedJobs = Array.from(this.jobs.values()).filter(j => j.status === 'failed').length;
    
    return {
      totalJobs,
      completedJobs,
      failedJobs,
      successRate: totalJobs > 0 ? completedJobs / totalJobs : 0,
      queueLength: this.processingQueue.length,
      isProcessing: this.isProcessing
    };
  }
}

// Singleton instance
export const backgroundPreloader = new BackgroundDataPreloader();

// Hook for components to trigger intelligent preloading
export function useDataPreloader() {
  const preloadForPage = (page: string) => {
    // Track user activity for intelligent caching
    localStorage.setItem('lastUserActivity', Date.now().toString());
    
    switch (page) {
      case '/dashboard':
        backgroundPreloader.preloadCriticalData();
        break;
      case '/competitors':
        backgroundPreloader.preloadForUserIntent('viewing-competitors');
        break;
      case '/recommendations':
        backgroundPreloader.preloadForUserIntent('checking-recommendations');
        break;
      case '/prompts':
        backgroundPreloader.preloadForUserIntent('analyzing-prompts');
        break;
    }
  };

  const warmCache = () => {
    const userActivity = {
      lastVisitedPages: JSON.parse(localStorage.getItem('visitedPages') || '[]'),
      frequentActions: JSON.parse(localStorage.getItem('frequentActions') || '[]'),
      timeOfDay: new Date().getHours()
    };
    
    backgroundPreloader.warmCacheIntelligently(userActivity);
  };

  return {
    preloadForPage,
    warmCache,
    getStats: () => backgroundPreloader.getStats()
  };
}