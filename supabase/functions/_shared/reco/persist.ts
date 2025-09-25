/**
 * Recommendation persistence with deduplication and cooldown logic
 */

import { Reco } from './engine.ts';

export async function upsertRecommendations(supabase: any, accountId: string, recos: Reco[]): Promise<void> {
  for (const reco of recos) {
    try {
      const cooldownDays = reco.cooldownDays || 14;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - cooldownDays);

      // Check if similar recommendation exists within cooldown period
      const { data: existing } = await supabase
        .from('recommendations')
        .select('id, created_at')
        .eq('org_id', accountId)
        .eq('type', reco.kind)
        .eq('title', reco.title)
        .in('status', ['open', 'snoozed'])
        .gte('created_at', cutoffDate.toISOString())
        .maybeSingle();

      if (existing) {
        console.log(`Skipping duplicate recommendation: ${reco.title} (exists since ${existing.created_at})`);
        continue;
      }

      // Insert new recommendation
      const { error } = await supabase
        .from('recommendations')
        .insert({
          org_id: accountId,
          type: reco.kind,
          title: reco.title,
          rationale: reco.rationale,
          status: 'open',
          metadata: {
            steps: reco.steps,
            estLift: reco.estLift,
            sourcePromptIds: reco.sourcePromptIds,
            sourceRunIds: reco.sourceRunIds,
            citations: reco.citations,
            cooldownDays: reco.cooldownDays
          }
        });

      if (error) {
        console.error(`Failed to insert recommendation "${reco.title}":`, error);
      } else {
        console.log(`Created recommendation: ${reco.title} (estimated lift: ${(reco.estLift * 100).toFixed(1)}%)`);
      }

    } catch (error: unknown) {
      console.error(`Error processing recommendation "${reco.title}":`, error);
    }
  }
}

/**
 * Alternative implementation using a PostgreSQL function for atomic upsert
 */
export async function upsertRecommendationsWithRPC(supabase: any, accountId: string, recos: Reco[]): Promise<void> {
  for (const reco of recos) {
    try {
      const { error } = await supabase.rpc('reco_upsert', {
        p_org_id: accountId,
        p_kind: reco.kind,
        p_title: reco.title,
        p_rationale: reco.rationale,
        p_steps: reco.steps,
        p_est_lift: reco.estLift,
        p_source_prompt_ids: reco.sourcePromptIds,
        p_source_run_ids: reco.sourceRunIds,
        p_citations: reco.citations,
        p_cooldown_days: reco.cooldownDays || 14
      });

      if (error) {
        console.error(`RPC upsert failed for "${reco.title}":`, error);
      }
    } catch (error: unknown) {
      console.error(`Error in RPC upsert for "${reco.title}":`, error);
    }
  }
}