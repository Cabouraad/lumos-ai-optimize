import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getStrictCorsHeaders, isRateLimited, getRateLimitHeaders } from "../_shared/cors.ts";

// Levenshtein distance implementation for similarity checking
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }
  
  return matrix[str2.length][str1.length];
}

function similarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1.0;
  return 1.0 - levenshteinDistance(str1, str2) / maxLen;
}

// Helper logging function
const logStep = (step: string, details?: any) => {
  const correlationId = crypto.randomUUID().slice(0, 8);
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CONVERT-COMPETITOR] [${correlationId}] ${step}${detailsStr}`);
};

// Error response helper with stable error codes
interface ApiError {
  error: string;
  code: string;
  details?: string;
}

function createErrorResponse(status: number, code: string, message: string, details?: string, requestOrigin?: string): Response {
  const error: ApiError = { error: message, code, details };
  return new Response(JSON.stringify(error), {
    status,
    headers: { ...getStrictCorsHeaders(requestOrigin), 'Content-Type': 'application/json' }
  });
}

// Input sanitization and validation
function sanitizeCompetitorName(name: string): string {
  if (typeof name !== 'string') {
    throw new Error('Competitor name must be a string');
  }
  
  // Trim whitespace
  let sanitized = name.trim();
  
  // Unicode normalize
  sanitized = sanitized.normalize('NFKC');
  
  // Remove dangerous characters (control chars, some unicode categories)
  sanitized = sanitized.replace(/[\x00-\x1F\x7F-\x9F\p{C}\p{Z}&&[^\x20]]/gu, '');
  
  // Remove script tags and other dangerous patterns
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/data:/gi, '');
  
  // Limit length
  if (sanitized.length > 100) {
    throw new Error('Competitor name too long (max 100 characters)');
  }
  
  if (sanitized.length < 2) {
    throw new Error('Competitor name too short (min 2 characters)');
  }
  
  return sanitized;
}

serve(async (req) => {
  const requestOrigin = req.headers.get('Origin');
  const corsHeaders = getStrictCorsHeaders(requestOrigin);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting
  const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  if (isRateLimited(clientIP, 30, 60000)) { // 30 requests per minute
    const rateLimitHeaders = getRateLimitHeaders(clientIP, 30, 60000);
    return new Response(JSON.stringify({ 
      error: 'Too many requests', 
      code: 'RATE_LIMITED',
      retryAfter: 60 
    }), {
      status: 429,
      headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' }
    });
  }

  logStep("Function started");

  // Only allow POST requests
  if (req.method !== 'POST') {
    return createErrorResponse(405, 'METHOD_NOT_ALLOWED', 'Only POST requests allowed', undefined, requestOrigin);
  }

  try {
    // Create Supabase client with user's JWT (not service role)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return createErrorResponse(401, 'MISSING_AUTH', 'Authorization header required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: authHeader } }
      }
    );

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.log('Authentication failed:', authError?.message);
      return createErrorResponse(401, 'INVALID_JWT', 'Invalid authentication token');
    }

    // Parse and validate request body
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return createErrorResponse(422, 'INVALID_JSON', 'Invalid JSON body');
    }

    const { competitorName, orgId, isMergeOperation = false } = body;

    // Validate required fields
    if (!competitorName || !orgId) {
      return createErrorResponse(422, 'MISSING_FIELDS', 'Missing required fields: competitorName, orgId');
    }

    // Validate orgId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(orgId)) {
      return createErrorResponse(422, 'INVALID_ORG_ID', 'Invalid organization ID format');
    }

    // Sanitize competitor name
    let sanitizedName: string;
    try {
      sanitizedName = sanitizeCompetitorName(competitorName);
    } catch (error: any) {
      return createErrorResponse(422, 'INVALID_INPUT', error.message);
    }

    // Get user's organization and role
    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('org_id, role')
      .eq('id', user.id)
      .single();

    if (userError || !userRecord) {
      console.log('User record not found:', userError?.message);
      return createErrorResponse(403, 'USER_NOT_FOUND', 'User not properly onboarded');
    }

    // Verify user belongs to the requested organization
    if (userRecord.org_id !== orgId) {
      console.log('Org access denied:', { userOrg: userRecord.org_id, requestedOrg: orgId });
      return createErrorResponse(403, 'ORG_ACCESS_DENIED', 'Access denied: user does not belong to this organization');
    }

    // Verify user has required role (owner or admin)
    const allowedRoles = ['owner', 'admin'];
    if (!allowedRoles.includes(userRecord.role)) {
      console.log('Role access denied:', { userRole: userRecord.role, allowedRoles });
      return createErrorResponse(403, 'INSUFFICIENT_ROLE', `Access denied: requires role in [${allowedRoles.join(', ')}], got: ${userRecord.role}`);
    }

    console.log('Converting competitor to org brand:', { 
      competitorName: sanitizedName, 
      orgId, 
      userId: user.id,
      userRole: userRecord.role,
      isMergeOperation
    });

    // Switch to service role for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get organization details to validate brand name similarity
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('name, domain')
      .eq('id', orgId)
      .single();

    if (orgError || !org) {
      console.error('Organization not found:', orgError);
      return createErrorResponse(404, 'ORG_NOT_FOUND', 'Organization not found');
    }

    // Enhanced similarity checking with Levenshtein distance
    const orgName = org.name.toLowerCase().trim();
    const orgDomain = org.domain.toLowerCase().replace(/\.(com|org|net|io|co).*$/, '').trim();
    const competitorLower = sanitizedName.toLowerCase().trim();

    // Calculate similarity scores
    const nameToCompetitorSim = similarity(orgName, competitorLower);
    const domainToCompetitorSim = similarity(orgDomain, competitorLower);
    const maxSimilarity = Math.max(nameToCompetitorSim, domainToCompetitorSim);

    // For merge operations, enforce minimum similarity threshold
    if (isMergeOperation && maxSimilarity < 0.8) {
      return createErrorResponse(422, 'SIMILARITY_TOO_LOW', 
        `Competitor name similarity too low for merge operation (${maxSimilarity.toFixed(2)} < 0.8). Use manual conversion instead.`,
        `Similarity scores: name=${nameToCompetitorSim.toFixed(2)}, domain=${domainToCompetitorSim.toFixed(2)}`
      );
    }

    // Log similarity for audit trail
    console.log('Similarity analysis:', {
      orgName,
      orgDomain, 
      competitorName: sanitizedName,
      nameToCompetitorSim: nameToCompetitorSim.toFixed(3),
      domainToCompetitorSim: domainToCompetitorSim.toFixed(3),
      maxSimilarity: maxSimilarity.toFixed(3),
      passesThreshold: maxSimilarity >= 0.8
    });

    // Check if this competitor already exists as org brand
    const { data: existingBrand, error: checkError } = await supabaseAdmin
      .from('brand_catalog')
      .select('id, is_org_brand, name')
      .eq('org_id', orgId)
      .ilike('name', sanitizedName)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing brand:', checkError);
      return createErrorResponse(500, 'DATABASE_ERROR', 'Failed to check existing brand');
    }

    let brandId: string;
    let isNewBrand = false;

    if (existingBrand) {
      if (existingBrand.is_org_brand) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Already marked as organization brand',
            brandId: existingBrand.id,
            code: 'ALREADY_ORG_BRAND'
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      } else {
        // Update existing competitor to be org brand
        const { error: updateError } = await supabaseAdmin
          .from('brand_catalog')
          .update({ 
            is_org_brand: true,
            name: sanitizedName, // Use sanitized version
            last_seen_at: new Date().toISOString()
          })
          .eq('id', existingBrand.id);

        if (updateError) {
          console.error('Error updating brand:', updateError);
          return createErrorResponse(500, 'UPDATE_FAILED', 'Failed to update brand');
        }
        brandId = existingBrand.id;
      }
    } else {
      // Create new org brand entry
      const { data: newBrand, error: insertError } = await supabaseAdmin
        .from('brand_catalog')
        .insert({
          org_id: orgId,
          name: sanitizedName,
          is_org_brand: true,
          variants_json: [],
          first_detected_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
          total_appearances: 1,
          average_score: 8.0 // High score for org brand
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('Error creating org brand:', insertError);
        return createErrorResponse(500, 'INSERT_FAILED', 'Failed to create organization brand');
      }
      
      brandId = newBrand.id;
      isNewBrand = true;
    }

    // Update recent prompt responses to fix classification
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: responses, error: responseError } = await supabaseAdmin
      .from('prompt_provider_responses')
      .select('id, competitors_json, brands_json, competitors_count, score, org_brand_present, metadata')
      .eq('org_id', orgId)
      .gte('run_at', thirtyDaysAgo.toISOString())
      .eq('status', 'success');

    let updatedResponseCount = 0;
    if (responseError) {
      console.error('Error fetching responses for update:', responseError);
    } else {
      for (const response of responses || []) {
        const competitors = response.competitors_json || [];
        const brands = response.brands_json || [];
        
        // Check if this competitor is in the list (case-insensitive)
        const competitorIndex = competitors.findIndex((comp: string) => 
          comp.toLowerCase().trim() === sanitizedName.toLowerCase().trim()
        );

        if (competitorIndex !== -1) {
          // Remove from competitors, add to brands if not already there
          const updatedCompetitors = competitors.filter((_: any, idx: number) => idx !== competitorIndex);
          const brandExists = brands.some((brand: string) => 
            brand.toLowerCase().trim() === sanitizedName.toLowerCase().trim()
          );
          const updatedBrands = brandExists ? brands : [...brands, sanitizedName];
          
          // Calculate new score (higher because org brand found)
          const newScore = response.org_brand_present ? response.score : Math.min(10, response.score + 3);
          
          const { error: updateResponseError } = await supabaseAdmin
            .from('prompt_provider_responses')
            .update({
              competitors_json: updatedCompetitors,
              brands_json: updatedBrands,
              competitors_count: updatedCompetitors.length,
              org_brand_present: true,
              org_brand_prominence: 1, // Assume good position
              score: newScore,
              metadata: {
                ...(response.metadata || {}),
                competitor_converted_to_brand: true,
                converted_competitor: sanitizedName,
                converted_by: user.id,
                converted_at: new Date().toISOString(),
                similarity_score: maxSimilarity.toFixed(3)
              }
            })
            .eq('id', response.id);

          if (!updateResponseError) {
            updatedResponseCount++;
          } else {
            console.error('Error updating response:', updateResponseError);
          }
        }
      }
    }

    console.log(`Successfully converted competitor: ${updatedResponseCount} responses updated`);

    return new Response(
      JSON.stringify({ 
        success: true,
        code: isNewBrand ? 'BRAND_CREATED' : 'COMPETITOR_CONVERTED',
        message: `Successfully converted "${sanitizedName}" to organization brand`,
        data: {
          brandId,
          originalName: competitorName,
          sanitizedName,
          isNewBrand,
          similarityScore: maxSimilarity.toFixed(3),
          responsesUpdated: updatedResponseCount
        },
        warning: maxSimilarity < 0.5 ? 'Brand name has low similarity to organization name' : undefined
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Unexpected error in convert-competitor-to-brand:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Don't expose internal error details
    return createErrorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});