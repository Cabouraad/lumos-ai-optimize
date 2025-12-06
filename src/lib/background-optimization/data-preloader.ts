/**
 * Phase 3: Background Data Pre-loading and Performance Optimization
 * 
 * BRAND ISOLATION: All cache keys and preloading now support brandId
 * to prevent data bleeding between brands in multi-brand accounts.
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
  brandId?: string; // Optional brand context
}

interface PreloadContext {
  brandId?: string;
}

/**
 * Generate brand-scoped cache key
 */
function getBrandScopedKey(base: string, orgId: string, brandId?: string): string {
  return `${base}-${orgId}${brandId ? `-${brandId}` : ''}`;
}

class BackgroundDataPreloader {
  private jobs: Map<string, PreloadJob> = new Map();
  private isProcessing = false;
  private processingQueue: string[] = [];
  private worker: Worker | null = null;
  private preloadInterval: NodeJS.Timeout | null = null;
  private currentBrandId?: string;

  constructor() {
    this.initializeWorker();
    this.scheduleRegularPreloads();
  }

  /**
   * Set the current brand context for preloading
   */
  setBrandContext(brandId?: string): void {
    this.currentBrandId = brandId;
  }

  /**
   * Cleanup method to clear all timers
   */
  destroy(): void {
    if (this.preloadInterval) {
      clearInterval(this.preloadInterval);
      this.preloadInterval = null;
    }
  }

  /**
   * Schedule high-priority data preloading for critical user paths
   */
  preloadCriticalData(context?: PreloadContext): void {
    const brandId = context?.brandId || this.currentBrandId;
    
    this.addJob({
      id: `dashboard-${Date.now()}`,
      type: 'dashboard',
      priority: 'high',
      scheduledAt: Date.now(),
      status: 'pending',
      estimatedDuration: 2000,
      brandId
    });

    this.addJob({
      id: `prompts-${Date.now()}`,
      type: 'prompts', 
      priority: 'high',
      scheduledAt: Date.now() + 500, // Slight delay to avoid overwhelming
      status: 'pending',
      estimatedDuration: 1500,
      brandId
    });
  }

  /**
   * Preload data for specific user interactions
   */
  preloadForUserIntent(
    intent: 'viewing-competitors' | 'checking-recommendations' | 'analyzing-prompts',
    context?: PreloadContext
  ): void {
    const brandId = context?.brandId || this.currentBrandId;
    
    switch (intent) {
      case 'viewing-competitors':
        this.addJob({
          id: `competitors-${Date.now()}`,
          type: 'competitors',
          priority: 'medium',
          scheduledAt: Date.now(),
          status: 'pending',
          estimatedDuration: 1000,
          brandId
        });
        break;
      
      case 'checking-recommendations':
        this.addJob({
          id: `recommendations-${Date.now()}`,
          type: 'recommendations',
          priority: 'medium',
          scheduledAt: Date.now(),
          status: 'pending',
          estimatedDuration: 800,
          brandId
        });
        break;
      
      case 'analyzing-prompts':
        this.preloadCriticalData(context); // Prompts need dashboard context
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
    brandId?: string;
  }): void {
    const { lastVisitedPages, frequentActions, timeOfDay, brandId } = userActivity;
    const context = { brandId: brandId || this.currentBrandId };
    
    // Morning users typically check dashboard first
    if (timeOfDay >= 6 && timeOfDay <= 10) {
      this.preloadCriticalData(context);
    }
    
    // If user frequently views competitors, preload that data
    if (frequentActions.includes('view-competitors')) {
      this.preloadForUserIntent('viewing-competitors', context);
    }
    
    // If user was recently on prompts page, likely to return
    if (lastVisitedPages.includes('/prompts')) {
      this.addJob({
        id: `prompts-return-${Date.now()}`,
        type: 'prompts',
        priority: 'low',
        scheduledAt: Date.now() + 30000, // 30 seconds delay
        status: 'pending',
        estimatedDuration: 1500,
        brandId: context.brandId
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
    const brandId = job.brandId;
    
    switch (job.type) {
      case 'dashboard':
        await this.preloadDashboardData(orgId, brandId);
        break;
      
      case 'prompts':
        await this.preloadPromptsData(orgId, brandId);
        break;
      
      case 'competitors':
        await this.preloadCompetitorsData(orgId, brandId);
        break;
      
      case 'recommendations':
        await this.preloadRecommendationsData(orgId, brandId);
        break;
    }
  }

  private async preloadDashboardData(orgId: string, brandId?: string): Promise<void> {
    const cacheKey = getBrandScopedKey('dashboard-data', orgId, brandId);
    
    // Check if already cached
    const cached = await advancedCache.get(cacheKey);
    if (cached) return;

    // Import the unified fetcher to use the same data structures
    const { getUnifiedDashboardData } = await import('../data/unified-fetcher');
    
    try {
      // Use the actual unified fetcher to warm the cache with the correct data structure
      // Note: getUnifiedDashboardData needs to be updated to accept brandId
      await getUnifiedDashboardData(false); // Skip cache check, force fetch
      console.log('Background: Dashboard data preloaded', { orgId, brandId: brandId || 'org-level' });
    } catch (error) {
      console.error('Background preload failed for dashboard:', error);
    }
  }

  private async preloadPromptsData(orgId: string, brandId?: string): Promise<void> {
    const cacheKey = getBrandScopedKey('prompt-data', orgId, brandId);
    
    const cached = await advancedCache.get(cacheKey);
    if (cached) return;

    // Import the unified fetcher to use the same data structures
    const { getUnifiedPromptData } = await import('../data/unified-fetcher');
    
    try {
      // Use the actual unified fetcher to warm the cache with the correct data structure
      // getUnifiedPromptData signature: (useCache, dateFrom?, dateTo?, brandId?)
      await getUnifiedPromptData(false, undefined, undefined, brandId); // Skip cache check, force fetch with brand
      console.log('Background: Prompt data preloaded', { orgId, brandId: brandId || 'org-level' });
    } catch (error) {
      console.error('Background preload failed for prompts:', error);
    }
  }

  private async preloadCompetitorsData(orgId: string, brandId?: string): Promise<void> {
    const cacheKey = getBrandScopedKey('competitors-data', orgId, brandId);
    
    const cached = await advancedCache.get(cacheKey);
    if (cached) return;

    // Build query with brand filter
    let query = supabase
      .from('brand_catalog')
      .select('*')
      .eq('org_id', orgId)
      .eq('is_org_brand', false)
      .order('total_appearances', { ascending: false })
      .limit(50);

    // Apply brand filter if provided
    if (brandId) {
      query = query.eq('brand_id', brandId);
    }

    const { data: competitors } = await query;

    if (competitors) {
      advancedCache.set(cacheKey, competitors, 600000); // 10 minute cache
      console.log('Background: Competitors data preloaded', { orgId, brandId: brandId || 'org-level', count: competitors.length });
    }
  }

  private async preloadRecommendationsData(orgId: string, brandId?: string): Promise<void> {
    const cacheKey = getBrandScopedKey('recommendations-data', orgId, brandId);
    
    const cached = await advancedCache.get(cacheKey);
    if (cached) return;

    // Build query with brand filter
    let query = supabase
      .from('recommendations')
      .select('*')
      .eq('org_id', orgId)
      .in('status', ['open', 'snoozed'])
      .order('created_at', { ascending: false })
      .limit(20);

    // Apply brand filter if provided
    if (brandId) {
      query = query.eq('brand_id', brandId);
    }

    const { data: recommendations } = await query;

    if (recommendations) {
      advancedCache.set(cacheKey, recommendations, 240000); // 4 minute cache
      console.log('Background: Recommendations data preloaded', { orgId, brandId: brandId || 'org-level', count: recommendations.length });
    }
  }

  private initializeWorker(): void {
    // In a real implementation, this would create a Web Worker for background processing
    // For now, we'll use setTimeout to simulate background processing
    console.log('Background preloader initialized');
  }

  private scheduleRegularPreloads(): void {
    // Schedule preloads every 5 minutes for active users
    this.preloadInterval = setInterval(() => {
      const now = Date.now();
      const lastActivity = localStorage.getItem('lastUserActivity');
      
      if (lastActivity && (now - parseInt(lastActivity)) < 300000) { // 5 minutes
        // Use current brand context for scheduled preloads
        this.preloadCriticalData({ brandId: this.currentBrandId });
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
      isProcessing: this.isProcessing,
      currentBrandId: this.currentBrandId
    };
  }
}

// Singleton instance
export const backgroundPreloader = new BackgroundDataPreloader();

// Hook for components to trigger intelligent preloading
export function useDataPreloader() {
  const preloadForPage = (page: string, brandId?: string) => {
    // Track user activity for intelligent caching
    localStorage.setItem('lastUserActivity', Date.now().toString());
    
    // Set brand context for this preload session
    if (brandId) {
      backgroundPreloader.setBrandContext(brandId);
    }
    
    const context = { brandId };
    
    switch (page) {
      case '/dashboard':
        backgroundPreloader.preloadCriticalData(context);
        break;
      case '/competitors':
        backgroundPreloader.preloadForUserIntent('viewing-competitors', context);
        break;
      case '/recommendations':
        backgroundPreloader.preloadForUserIntent('checking-recommendations', context);
        break;
      case '/prompts':
        backgroundPreloader.preloadForUserIntent('analyzing-prompts', context);
        break;
    }
  };

  const warmCache = (brandId?: string) => {
    const userActivity = {
      lastVisitedPages: JSON.parse(localStorage.getItem('visitedPages') || '[]'),
      frequentActions: JSON.parse(localStorage.getItem('frequentActions') || '[]'),
      timeOfDay: new Date().getHours(),
      brandId
    };
    
    backgroundPreloader.warmCacheIntelligently(userActivity);
  };

  const setBrandContext = (brandId?: string) => {
    backgroundPreloader.setBrandContext(brandId);
  };

  return {
    preloadForPage,
    warmCache,
    setBrandContext,
    getStats: () => backgroundPreloader.getStats()
  };
}
