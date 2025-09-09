import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { detectBrandMentions } from '../_shared/citations-enhanced.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory cache for 24h
const urlCache = new Map<string, { content: string; expires: number; hasMention: boolean; confidence: number }>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify CRON_SECRET for security
    const authHeader = req.headers.get('authorization');
    const cronSecret = Deno.env.get('CRON_SECRET');
    
    if (!authHeader || !cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { response_id } = await req.json();
    if (!response_id) {
      return new Response(JSON.stringify({ error: 'Missing response_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`🔍 Processing citations for response ${response_id}`);

    // Get response data
    const { data: response, error } = await supabase
      .from('prompt_provider_responses')
      .select('id, org_id, citations_json')
      .eq('id', response_id)
      .single();

    if (error || !response) {
      console.error('Response not found:', error);
      return new Response(JSON.stringify({ error: 'Response not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!response.citations_json?.citations) {
      console.log('No citations to process');
      return new Response(JSON.stringify({ message: 'No citations to process' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get org brands for this organization
    const { data: orgBrands } = await supabase
      .from('brand_catalog')
      .select('name, variants_json')
      .eq('org_id', response.org_id)
      .eq('is_org_brand', true);

    if (!orgBrands || orgBrands.length === 0) {
      console.log('No org brands found, skipping brand detection');
      return new Response(JSON.stringify({ message: 'No org brands found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let processed = 0;
    let updated = 0;
    const citations = response.citations_json.citations;
    
    // Rate limiting: process max 5 URLs concurrently
    const concurrencyLimit = 3;
    const batches = [];
    for (let i = 0; i < citations.length; i += concurrencyLimit) {
      batches.push(citations.slice(i, i + concurrencyLimit));
    }

    for (const batch of batches) {
      await Promise.all(batch.map(async (citation: any, index: number) => {
        if (citation.brand_mention !== 'unknown') {
          return; // Already processed
        }

        processed++;
        console.log(`Processing citation ${processed}: ${citation.domain}`);

        try {
          const urlHash = await hashUrl(citation.url);
          const now = Date.now();
          
          // Check cache first
          const cached = urlCache.get(urlHash);
          if (cached && cached.expires > now) {
            console.log(`Cache hit for ${citation.domain}`);
            citation.brand_mention = cached.hasMention ? 'yes' : 'no';
            citation.brand_mention_confidence = cached.confidence;
            updated++;
            return;
          }

          // Check robots.txt (simple HEAD request)
          const robotsAllowed = await checkRobotsAllowed(citation.url);
          if (!robotsAllowed) {
            console.log(`Robots.txt disallowed for ${citation.domain}`);
            citation.brand_mention = 'no';
            citation.brand_mention_confidence = 0.9;
            return;
          }

          // Fetch content with timeout and size limit
          const content = await fetchPageContent(citation.url);
          if (!content) {
            console.log(`Failed to fetch content for ${citation.domain}`);
            return; // Leave as unknown
          }

          // Detect brand mentions
          const detection = detectBrandMentions(content, orgBrands);
          citation.brand_mention = detection.hasMention ? 'yes' : 'no';
          citation.brand_mention_confidence = detection.confidence;
          
          // Cache the result
          urlCache.set(urlHash, {
            content,
            expires: now + CACHE_DURATION,
            hasMention: detection.hasMention,
            confidence: detection.confidence
          });
          
          updated++;
          console.log(`Updated ${citation.domain}: ${citation.brand_mention} (confidence: ${citation.brand_mention_confidence})`);
          
        } catch (error) {
          console.error(`Error processing ${citation.url}:`, error.message);
          // Leave as unknown on error
        }
      }));
      
      // Small delay between batches to be respectful
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Update the database with processed citations
    if (updated > 0) {
      const { error: updateError } = await supabase
        .from('prompt_provider_responses')
        .update({ 
          citations_json: {
            ...response.citations_json,
            citations: citations
          }
        })
        .eq('id', response_id);

      if (updateError) {
        console.error('Failed to update citations:', updateError);
        return new Response(JSON.stringify({ error: 'Failed to update citations' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    console.log(`✅ Processed ${processed} citations, updated ${updated}`);
    
    return new Response(JSON.stringify({ 
      success: true, 
      processed,
      updated,
      response_id 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Citation mention analysis error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function hashUrl(url: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(url);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('').slice(0, 16);
}

async function checkRobotsAllowed(url: string): Promise<boolean> {
  try {
    const urlObj = new URL(url);
    const robotsUrl = `${urlObj.protocol}//${urlObj.host}/robots.txt`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(robotsUrl, {
      method: 'HEAD',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // If robots.txt doesn't exist or is accessible, allow crawling
    // This is a simple check - a full robots.txt parser would be more thorough
    return response.status === 404 || response.ok;
  } catch {
    // If we can't check robots.txt, err on the side of caution and allow
    return true;
  }
}

async function fetchPageContent(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
    
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'LLumos-Citation-Bot/1.0 (+https://llumos.app/about)'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return null;
    }
    
    const contentType = response.headers.get('content-type') || '';
    
    // Only process text/html and text/plain
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      return null;
    }
    
    // Limit content size to 512KB
    const reader = response.body?.getReader();
    if (!reader) return null;
    
    let content = '';
    let totalSize = 0;
    const maxSize = 512 * 1024; // 512KB
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      totalSize += value.length;
      if (totalSize > maxSize) {
        reader.cancel();
        break;
      }
      
      content += new TextDecoder().decode(value);
    }
    
    // Extract text from HTML (basic cleanup)
    if (contentType.includes('text/html')) {
      content = content
        .replace(/<script[^>]*>.*?<\/script>/gsi, '')
        .replace(/<style[^>]*>.*?<\/style>/gsi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    return content.slice(0, 50000); // Limit to 50K chars for processing
    
  } catch (error) {
    console.error(`Failed to fetch ${url}:`, error.message);
    return null;
  }
}