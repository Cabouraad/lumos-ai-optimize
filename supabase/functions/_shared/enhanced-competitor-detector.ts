/**
 * Enhanced Competitor Detection Service
 * Uses gazetteer + brand validation + NER fallback for accurate competitor identification
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface CompetitorMatch {
  name: string;
  normalized: string;
  mentions: number;
  first_pos_ratio: number;
  confidence: number;
  source: 'gazetteer' | 'ner' | 'catalog';
}

export interface CompetitorDetectionResult {
  competitors: CompetitorMatch[];
  orgBrands: CompetitorMatch[];
  rejectedTerms: string[];
  metadata: {
    gazetteer_matches: number;
    ner_matches: number;
    total_candidates: number;
    processing_time_ms: number;
  };
}

// Enhanced stopwords list - common English words that should never be competitors
const STOPWORDS = new Set([
  // Pronouns, articles, prepositions
  'i', 'me', 'my', 'we', 'us', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'they', 'them', 'their',
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'about',
  'into', 'through', 'over', 'under', 'above', 'below', 'up', 'down', 'out', 'off', 'away', 'back', 'here', 'there',
  
  // Common verbs
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'can', 'go', 'goes', 'went', 'gone', 'get', 'gets', 'got', 'gotten', 'make', 'makes',
  'made', 'take', 'takes', 'took', 'taken', 'come', 'comes', 'came', 'see', 'sees', 'saw', 'seen', 'know', 'knows', 'knew',
  'use', 'uses', 'used', 'using', 'work', 'works', 'worked', 'working', 'help', 'helps', 'helped', 'helping',
  'create', 'creates', 'created', 'creating', 'build', 'builds', 'built', 'building', 'find', 'finds', 'found',
  'think', 'thinks', 'thought', 'thinking', 'feel', 'feels', 'felt', 'feeling', 'look', 'looks', 'looked', 'looking',
  'seem', 'seems', 'seemed', 'seeming', 'become', 'becomes', 'became', 'becoming', 'leave', 'leaves', 'left', 'leaving',
  'try', 'tries', 'tried', 'trying', 'ask', 'asks', 'asked', 'asking', 'need', 'needs', 'needed', 'needing',
  'want', 'wants', 'wanted', 'wanting', 'turn', 'turns', 'turned', 'turning', 'start', 'starts', 'started', 'starting',
  'show', 'shows', 'showed', 'shown', 'showing', 'play', 'plays', 'played', 'playing', 'run', 'runs', 'ran', 'running',
  'move', 'moves', 'moved', 'moving', 'live', 'lives', 'lived', 'living', 'believe', 'believes', 'believed', 'believing',
  'hold', 'holds', 'held', 'holding', 'bring', 'brings', 'brought', 'bringing', 'happen', 'happens', 'happened', 'happening',
  'write', 'writes', 'wrote', 'written', 'writing', 'provide', 'provides', 'provided', 'providing', 'sit', 'sits', 'sat', 'sitting',
  'stand', 'stands', 'stood', 'standing', 'lose', 'loses', 'lost', 'losing', 'pay', 'pays', 'paid', 'paying',
  'meet', 'meets', 'met', 'meeting', 'include', 'includes', 'included', 'including', 'continue', 'continues', 'continued', 'continuing',
  'set', 'sets', 'setting', 'remain', 'remains', 'remained', 'remaining', 'add', 'adds', 'added', 'adding',
  'change', 'changes', 'changed', 'changing', 'lead', 'leads', 'led', 'leading', 'understand', 'understands', 'understood', 'understanding',
  'watch', 'watches', 'watched', 'watching', 'follow', 'follows', 'followed', 'following', 'stop', 'stops', 'stopped', 'stopping',
  'read', 'reads', 'reading', 'open', 'opens', 'opened', 'opening', 'walk', 'walks', 'walked', 'walking',
  'talk', 'talks', 'talked', 'talking', 'speak', 'speaks', 'spoke', 'spoken', 'speaking', 'allow', 'allows', 'allowed', 'allowing',
  'win', 'wins', 'won', 'winning', 'offer', 'offers', 'offered', 'offering', 'remember', 'remembers', 'remembered', 'remembering',
  'love', 'loves', 'loved', 'loving', 'consider', 'considers', 'considered', 'considering', 'appear', 'appears', 'appeared', 'appearing',
  'buy', 'buys', 'bought', 'buying', 'wait', 'waits', 'waited', 'waiting', 'serve', 'serves', 'served', 'serving',
  'die', 'dies', 'died', 'dying', 'send', 'sends', 'sent', 'sending', 'expect', 'expects', 'expected', 'expecting',
  'stay', 'stays', 'stayed', 'staying', 'let', 'lets', 'letting', 'begin', 'begins', 'began', 'begun', 'beginning',
  'keep', 'keeps', 'kept', 'keeping', 'learn', 'learns', 'learned', 'learning', 'decide', 'decides', 'decided', 'deciding',
  'happen', 'happens', 'happened', 'happening', 'develop', 'develops', 'developed', 'developing', 'carry', 'carries', 'carried', 'carrying',
  'break', 'breaks', 'broke', 'broken', 'breaking', 'reach', 'reaches', 'reached', 'reaching', 'tell', 'tells', 'told', 'telling',
  'increase', 'increases', 'increased', 'increasing', 'return', 'returns', 'returned', 'returning', 'explain', 'explains', 'explained', 'explaining',
  
  // Common nouns that are never competitors
  'time', 'person', 'year', 'way', 'day', 'thing', 'man', 'world', 'life', 'hand', 'part', 'child', 'eye', 'woman', 'place',
  'work', 'week', 'case', 'point', 'government', 'company', 'number', 'group', 'problem', 'fact', 'business', 'service',
  'money', 'story', 'lot', 'water', 'book', 'month', 'right', 'study', 'people', 'word', 'issue', 'side', 'kind', 'head',
  'house', 'area', 'country', 'question', 'school', 'interest', 'state', 'power', 'policy', 'help', 'line', 'music',
  'market', 'name', 'idea', 'body', 'information', 'back', 'parent', 'face', 'others', 'level', 'office', 'door',
  'health', 'person', 'art', 'war', 'history', 'party', 'result', 'change', 'morning', 'reason', 'research', 'girl', 'guy',
  'moment', 'air', 'teacher', 'force', 'education', 'experience', 'job', 'book', 'end', 'community', 'system', 'program',
  'those', 'start', 'made', 'home', 'room', 'mother', 'area', 'age', 'policy', 'everything', 'love', 'process', 'music',
  'including', 'consider', 'appear', 'actually', 'buy', 'probably', 'human', 'wait', 'serve', 'market', 'die', 'send',
  'expect', 'home', 'sense', 'build', 'stay', 'fall', 'oh', 'nation', 'plan', 'cut', 'college', 'interest', 'death',
  'course', 'someone', 'experience', 'behind', 'reach', 'local', 'kill', 'six', 'remain', 'effect', 'use', 'yeah', 'suggest',
  'class', 'control', 'raise', 'care', 'perhaps', 'little', 'late', 'hard', 'field', 'else', 'pass', 'former', 'sell',
  'major', 'sometimes', 'require', 'along', 'development', 'themselves', 'report', 'role', 'better', 'economic', 'effort',
  'up', 'decide', 'rate', 'strong', 'possible', 'heart', 'drug', 'show', 'leader', 'light', 'voice', 'wife', 'whole',
  'police', 'mind', 'finally', 'pull', 'return', 'free', 'military', 'price', 'less', 'according', 'decision', 'explain',
  'son', 'hope', 'even', 'develop', 'view', 'relationship', 'carry', 'town', 'road', 'drive', 'arm', 'true', 'federal',
  'break', 'better', 'difference', 'thank', 'receive', 'value', 'international', 'building', 'action', 'full', 'model',
  'join', 'season', 'society', 'because', 'tax', 'director', 'early', 'position', 'player', 'agree', 'especially', 'record',
  'pick', 'wear', 'paper', 'special', 'space', 'ground', 'form', 'support', 'event', 'official', 'whose', 'matter', 'everyone',
  'center', 'couple', 'site', 'project', 'hit', 'base', 'activity', 'star', 'table', 'court', 'produce', 'eat', 'teach',
  'oil', 'half', 'situation', 'easy', 'cost', 'industry', 'figure', 'face', 'street', 'image', 'itself', 'phone', 'either',
  'data', 'cover', 'quite', 'picture', 'clear', 'practice', 'piece', 'land', 'recent', 'describe', 'product', 'doctor',
  'wall', 'patient', 'worker', 'news', 'test', 'movie', 'certain', 'north', 'personal', 'simply', 'third', 'technology',
  'catch', 'step', 'baby', 'computer', 'type', 'attention', 'draw', 'film', 'republican', 'tree', 'source', 'red', 'nearly',
  'organization', 'choose', 'cause', 'hair', 'century', 'evidence', 'window', 'difficult', 'listen', 'soon', 'culture',
  'billion', 'chance', 'brother', 'energy', 'period', 'course', 'summer', 'less', 'realize', 'hundred', 'available',
  'plant', 'likely', 'opportunity', 'term', 'short', 'letter', 'condition', 'choice', 'place', 'single', 'rule', 'daughter',
  'administration', 'south', 'husband', 'congress', 'floor', 'campaign', 'material', 'population', 'well', 'call', 'economy',
  'medical', 'hospital', 'church', 'close', 'thousand', 'risk', 'current', 'fire', 'future', 'wrong', 'involve', 'defense',
  'anyone', 'increase', 'security', 'bank', 'myself', 'certainly', 'west', 'sport', 'board', 'seek', 'per', 'subject',
  'officer', 'private', 'rest', 'behavior', 'deal', 'performance', 'fight', 'throw', 'top', 'quickly', 'past', 'goal',
  'bed', 'order', 'author', 'fill', 'represent', 'focus', 'foreign', 'drop', 'plan', 'blood', 'upon', 'agency', 'push',
  'nature', 'color', 'no', 'recently', 'store', 'reduce', 'sound', 'note', 'fine', 'before', 'near', 'movement', 'page',
  'enter', 'share', 'than', 'common', 'poor', 'other', 'natural', 'race', 'concern', 'series', 'significant', 'similar',
  'hot', 'language', 'each', 'usually', 'response', 'dead', 'rise', 'animal', 'factor', 'decade', 'article', 'shoot',
  'east', 'save', 'seven', 'artist', 'away', 'scene', 'stock', 'career', 'despite', 'central', 'eight', 'thus', 'treatment',
  'beyond', 'happy', 'exactly', 'protect', 'approach', 'lie', 'size', 'dog', 'fund', 'serious', 'occur', 'media', 'ready',
  'sign', 'thought', 'list', 'individual', 'simple', 'quality', 'pressure', 'accept', 'answer', 'hard', 'resource', 'identify',
  'left', 'meeting', 'determine', 'prepare', 'disease', 'whatever', 'success', 'argue', 'cup', 'particularly', 'amount',
  'ability', 'staff', 'recognize', 'indicate', 'character', 'growth', 'loss', 'degree', 'wonder', 'attack', 'herself',
  'region', 'television', 'box', 'tv', 'training', 'pretty', 'trade', 'deal', 'election', 'everybody', 'physical', 'lay',
  'general', 'feeling', 'standard', 'bill', 'message', 'fail', 'outside', 'arrive', 'analysis', 'benefit', 'name', 'sex',
  'forward', 'lawyer', 'present', 'section', 'environmental', 'glass', 'answer', 'skill', 'sister', 'pm', 'professor',
  'operation', 'financial', 'crime', 'stage', 'ok', 'compare', 'authority', 'miss', 'design', 'sort', 'one', 'act',
  'ten', 'knowledge', 'gun', 'station', 'blue', 'state', 'strategy', 'little', 'clearly', 'discuss', 'indeed', 'force',
  'truth', 'song', 'example', 'democratic', 'check', 'environment', 'leg', 'dark', 'public', 'various', 'rather', 'laugh',
  'guess', 'executive', 'set', 'study', 'prove', 'hang', 'entire', 'rock', 'forget', 'claim', 'remove', 'manager', 'enjoy',
  'network', 'legal', 'religious', 'cold', 'form', 'final', 'main', 'science', 'green', 'memory', 'card', 'above', 'seat',
  'cell', 'establish', 'nice', 'trial', 'expert', 'that', 'spring', 'firm', 'democrat', 'radio', 'visit', 'management',
  'care', 'avoid', 'imagine', 'tonight', 'huge', 'ball', 'no', 'close', 'finish', 'yourself', 'talk', 'theory', 'impact',
  'respond', 'statement', 'maintain', 'charge', 'popular', 'traditional', 'onto', 'reveal', 'direction', 'weapon', 'employee',
  'cultural', 'contain', 'peace', 'head', 'control', 'base', 'pain', 'apply', 'play', 'measure', 'wide', 'shake', 'fly',
  'interview', 'manage', 'chair', 'fish', 'particular', 'camera', 'structure', 'politics', 'perform', 'bit', 'weight',
  'suddenly', 'discover', 'candidate', 'top', 'production', 'treat', 'trip', 'evening', 'affect', 'inside', 'conference',
  'unit', 'best', 'style', 'adult', 'worry', 'range', 'mention', 'rather', 'far', 'deep', 'front', 'edge', 'individual',
  'specific', 'writer', 'trouble', 'necessary', 'throughout', 'challenge', 'fear', 'shoulder', 'institution', 'middle',
  'sea', 'dream', 'bar', 'beautiful', 'property', 'instead', 'improve', 'stuff',
  
  // Common adjectives/adverbs that could be capitalized
  'new', 'old', 'good', 'bad', 'small', 'large', 'big', 'little', 'long', 'short', 'high', 'low', 'right', 'left', 'next',
  'last', 'first', 'second', 'third', 'early', 'late', 'young', 'old', 'important', 'social', 'political', 'national',
  'local', 'great', 'real', 'different', 'same', 'own', 'current', 'available', 'total', 'general', 'recent', 'human',
  'black', 'white', 'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'brown', 'pink', 'gray', 'clear', 'dark',
  'light', 'bright', 'full', 'empty', 'open', 'closed', 'free', 'cheap', 'expensive', 'rich', 'poor', 'clean', 'dirty',
  'easy', 'hard', 'simple', 'complex', 'fast', 'slow', 'quick', 'strong', 'weak', 'heavy', 'light', 'hot', 'cold', 'warm',
  'cool', 'dry', 'wet', 'loud', 'quiet', 'safe', 'dangerous', 'healthy', 'sick', 'happy', 'sad', 'angry', 'tired', 'busy',
  'ready', 'sure', 'possible', 'impossible', 'necessary', 'special', 'certain', 'similar', 'different', 'various',
  'several', 'many', 'few', 'much', 'little', 'enough', 'more', 'most', 'less', 'least', 'all', 'some', 'any', 'no',
  'every', 'each', 'other', 'another', 'both', 'either', 'neither', 'such', 'same', 'own', 'very', 'too', 'quite',
  'rather', 'pretty', 'really', 'truly', 'certainly', 'probably', 'perhaps', 'maybe', 'actually', 'especially',
  'particularly', 'generally', 'usually', 'normally', 'often', 'sometimes', 'always', 'never', 'still', 'yet', 'already',
  'again', 'once', 'twice', 'together', 'alone', 'away', 'back', 'here', 'there', 'where', 'everywhere', 'anywhere',
  'somewhere', 'nowhere', 'inside', 'outside', 'above', 'below', 'over', 'under', 'up', 'down', 'around', 'through',
  'across', 'along', 'during', 'before', 'after', 'since', 'until', 'while', 'when', 'whenever', 'where', 'wherever',
  'how', 'however', 'why', 'because', 'so', 'therefore', 'thus', 'hence', 'though', 'although', 'unless', 'if', 'whether',
  'than', 'as', 'like', 'unlike', 'besides', 'except', 'without', 'within', 'between', 'among', 'against', 'toward',
  'towards', 'near', 'far', 'close', 'next', 'behind', 'beyond', 'beside', 'beneath', 'concerning', 'regarding',
  
  // Action/process words commonly misidentified
  'making', 'doing', 'going', 'coming', 'getting', 'having', 'being', 'saying', 'knowing', 'thinking', 'looking',
  'seeming', 'feeling', 'becoming', 'leaving', 'trying', 'asking', 'needing', 'wanting', 'turning', 'starting',
  'showing', 'playing', 'running', 'moving', 'living', 'believing', 'holding', 'bringing', 'happening', 'writing',
  'providing', 'sitting', 'standing', 'losing', 'paying', 'meeting', 'including', 'continuing', 'setting',
  'remaining', 'adding', 'changing', 'leading', 'understanding', 'watching', 'following', 'stopping', 'reading',
  'opening', 'walking', 'talking', 'speaking', 'allowing', 'winning', 'offering', 'remembering', 'loving',
  'considering', 'appearing', 'buying', 'waiting', 'serving', 'dying', 'sending', 'expecting', 'staying',
  'letting', 'beginning', 'keeping', 'learning', 'deciding', 'developing', 'carrying', 'breaking', 'reaching',
  'telling', 'increasing', 'returning', 'explaining', 'focusing',
  
  // Technology/business terms that are too generic
  'solution', 'solutions', 'platform', 'platforms', 'software', 'application', 'applications', 'system', 'systems',
  'tool', 'tools', 'service', 'services', 'product', 'products', 'technology', 'technologies', 'digital', 'online',
  'cloud', 'web', 'mobile', 'app', 'apps', 'website', 'websites', 'internet', 'network', 'networks', 'data',
  'database', 'databases', 'server', 'servers', 'client', 'clients', 'user', 'users', 'customer', 'customers',
  'business', 'businesses', 'company', 'companies', 'organization', 'organizations', 'enterprise', 'enterprises',
  'management', 'marketing', 'sales', 'support', 'development', 'design', 'analytics', 'analysis', 'report',
  'reports', 'dashboard', 'dashboards', 'integration', 'integrations', 'automation', 'workflow', 'workflows',
  'process', 'processes', 'feature', 'features', 'function', 'functions', 'module', 'modules', 'component',
  'components', 'framework', 'frameworks', 'library', 'libraries', 'api', 'apis', 'interface', 'interfaces',
  'experience', 'performance', 'optimization', 'security', 'privacy', 'compliance', 'collaboration', 'communication',
  'productivity', 'efficiency', 'scalability', 'reliability', 'availability', 'flexibility', 'usability',
  'accessibility', 'compatibility', 'functionality', 'capability', 'capacity', 'quality', 'innovation', 'transformation'
]);

/**
 * Enhanced Competitor Detector Class
 */
export class EnhancedCompetitorDetector {
  private supabase: any;
  private gazetteer: Map<string, { name: string; source: string; normalized: string }> = new Map();
  private orgBrands: Set<string> = new Set();

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  /**
   * Initialize gazetteer from multiple sources
   */
  async initializeGazetteer(orgId: string): Promise<void> {
    console.log('🔍 Initializing competitor gazetteer for org:', orgId);
    
    try {
      // 1. Load from brand_catalog (competitors + org brands)
      const { data: brandCatalog } = await this.supabase
        .from('brand_catalog')
        .select('name, variants_json, is_org_brand')
        .eq('org_id', orgId);

      if (brandCatalog) {
        for (const brand of brandCatalog) {
          const normalized = this.normalizeBrand(brand.name);
          if (brand.is_org_brand) {
            this.orgBrands.add(normalized);
          } else {
            this.gazetteer.set(normalized, {
              name: brand.name,
              source: 'catalog',
              normalized
            });
          }
          
          // Add variants
          if (brand.variants_json) {
            for (const variant of brand.variants_json) {
              const normalizedVariant = this.normalizeBrand(variant);
              if (brand.is_org_brand) {
                this.orgBrands.add(normalizedVariant);
              } else {
                this.gazetteer.set(normalizedVariant, {
                  name: variant,
                  source: 'catalog_variant',
                  normalized: normalizedVariant
                });
              }
            }
          }
        }
      }

      // 2. Load from organization's competitorsSeed if available
      const { data: org } = await this.supabase
        .from('organizations')
        .select('name, metadata')
        .eq('id', orgId)
        .single();

      if (org?.metadata?.competitorsSeed) {
        for (const competitor of org.metadata.competitorsSeed) {
          const normalized = this.normalizeBrand(competitor);
          if (!this.gazetteer.has(normalized) && !this.orgBrands.has(normalized)) {
            this.gazetteer.set(normalized, {
              name: competitor,
              source: 'seed',
              normalized
            });
          }
        }
      }

      // 3. Load frequently mentioned competitors from past runs (top 50)
      const { data: pastCompetitors } = await this.supabase
        .from('prompt_provider_responses')
        .select('competitors_json')
        .eq('org_id', orgId)
        .not('competitors_json', 'is', null)
        .gte('run_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()) // Last 90 days
        .limit(200);

      if (pastCompetitors) {
        const competitorCounts = new Map<string, number>();
        
        for (const row of pastCompetitors) {
          if (Array.isArray(row.competitors_json)) {
            for (const competitor of row.competitors_json) {
              const normalized = this.normalizeBrand(competitor);
              if (!this.orgBrands.has(normalized)) {
                competitorCounts.set(normalized, (competitorCounts.get(normalized) || 0) + 1);
              }
            }
          }
        }

        // Add top 50 most mentioned competitors
        const sortedCompetitors = Array.from(competitorCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 50);

        for (const [normalized, count] of sortedCompetitors) {
          if (!this.gazetteer.has(normalized) && count >= 3) { // At least 3 mentions
            this.gazetteer.set(normalized, {
              name: this.capitalizeWords(normalized),
              source: 'historical',
              normalized
            });
          }
        }
      }

      console.log(`✅ Gazetteer initialized: ${this.gazetteer.size} competitors, ${this.orgBrands.size} org brands`);
      
    } catch (error) {
      console.error('❌ Error initializing gazetteer:', error);
    }
  }

  /**
   * Main detection method
   */
  async detectCompetitors(
    text: string,
    orgId: string,
    options: {
      useNERFallback?: boolean;
      maxCandidates?: number;
      confidenceThreshold?: number;
    } = {}
  ): Promise<CompetitorDetectionResult> {
    const startTime = Date.now();
    const {
      useNERFallback = true,
      maxCandidates = 20,
      confidenceThreshold = 0.7
    } = options;

    // Initialize gazetteer if not already done
    if (this.gazetteer.size === 0) {
      await this.initializeGazetteer(orgId);
    }

    const competitors: CompetitorMatch[] = [];
    const orgBrands: CompetitorMatch[] = [];
    const rejectedTerms: string[] = [];
    let gazetteerMatches = 0;
    let nerMatches = 0;

    // Step 1: Extract potential brand candidates using regex patterns
    const candidates = this.extractBrandCandidates(text);
    
    console.log(`🔍 Found ${candidates.length} brand candidates:`, candidates.slice(0, 10));

    // Step 2: Validate and match against gazetteer
    for (const candidate of candidates) {
      if (!this.isValidBrandName(candidate.name)) {
        rejectedTerms.push(candidate.name);
        continue;
      }

      const normalized = this.normalizeBrand(candidate.name);
      
      // Check if it's an org brand
      if (this.orgBrands.has(normalized)) {
        orgBrands.push({
          name: candidate.name,
          normalized,
          mentions: candidate.mentions,
          first_pos_ratio: candidate.first_pos_ratio,
          confidence: 0.95,
          source: 'gazetteer'
        });
        continue;
      }

      // Check gazetteer for competitors
      const gazetteerMatch = this.gazetteer.get(normalized);
      if (gazetteerMatch) {
        competitors.push({
          name: gazetteerMatch.name,
          normalized,
          mentions: candidate.mentions,
          first_pos_ratio: candidate.first_pos_ratio,
          confidence: 0.9,
          source: 'gazetteer'
        });
        gazetteerMatches++;
        continue;
      }

      // If not found in gazetteer, add to rejected for potential NER processing
      rejectedTerms.push(candidate.name);
    }

    // Step 3: NER Fallback for unmatched candidates (if enabled)
    if (useNERFallback && rejectedTerms.length > 0) {
      try {
        const nerCompetitors = await this.performNERExtraction(
          text,
          rejectedTerms.slice(0, 15) // Limit to prevent excessive API calls
        );
        
        for (const nerComp of nerCompetitors) {
          if (competitors.length < maxCandidates) {
            competitors.push(nerComp);
            nerMatches++;
          }
        }
      } catch (error) {
        console.error('❌ NER fallback failed:', error);
      }
    }

    // Step 4: Sort and filter by confidence
    const finalCompetitors = competitors
      .filter(c => c.confidence >= confidenceThreshold)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxCandidates);

    const finalOrgBrands = orgBrands
      .sort((a, b) => b.confidence - a.confidence);

    const processingTime = Date.now() - startTime;
    
    console.log(`✅ Detection complete: ${finalCompetitors.length} competitors, ${finalOrgBrands.length} org brands (${processingTime}ms)`);

    return {
      competitors: finalCompetitors,
      orgBrands: finalOrgBrands,
      rejectedTerms: rejectedTerms.filter(t => !finalCompetitors.some(c => c.name === t)),
      metadata: {
        gazetteer_matches: gazetteerMatches,
        ner_matches: nerMatches,
        total_candidates: candidates.length,
        processing_time_ms: processingTime
      }
    };
  }

  /**
   * Extract potential brand candidates using regex patterns
   */
  private extractBrandCandidates(text: string): Array<{
    name: string;
    mentions: number;
    first_pos_ratio: number;
  }> {
    const candidates = new Map<string, { mentions: number; first_position: number }>();
    const textLength = text.length;

    // Pattern 1: Capitalized words/phrases (most common pattern for brand names)
    const capitalizedPattern = /\b[A-Z][a-zA-Z0-9]*(?:\s+[A-Z][a-zA-Z0-9]*){0,3}\b/g;
    let match;
    
    while ((match = capitalizedPattern.exec(text)) !== null) {
      const candidate = match[0].trim();
      if (candidate.length >= 3 && candidate.length <= 30) {
        const existing = candidates.get(candidate);
        if (existing) {
          existing.mentions++;
        } else {
          candidates.set(candidate, {
            mentions: 1,
            first_position: match.index
          });
        }
      }
    }

    // Pattern 2: Domain-like names (e.g., "salesforce.com" -> "Salesforce")
    const domainPattern = /\b([a-zA-Z0-9-]+)\.(com|io|net|org|co|ai)\b/g;
    while ((match = domainPattern.exec(text)) !== null) {
      const domainName = match[1];
      if (domainName.length >= 3 && domainName.length <= 20) {
        const brandName = this.capitalizeWords(domainName);
        const existing = candidates.get(brandName);
        if (existing) {
          existing.mentions++;
        } else {
          candidates.set(brandName, {
            mentions: 1,
            first_position: match.index
          });
        }
      }
    }

    // Pattern 3: Quoted brand names
    const quotedPattern = /"([A-Z][^"]{2,29})"/g;
    while ((match = quotedPattern.exec(text)) !== null) {
      const candidate = match[1].trim();
      if (candidate.length >= 3 && candidate.length <= 30) {
        const existing = candidates.get(candidate);
        if (existing) {
          existing.mentions++;
        } else {
          candidates.set(candidate, {
            mentions: 1,
            first_position: match.index
          });
        }
      }
    }

    // Convert to array with first_pos_ratio
    return Array.from(candidates.entries()).map(([name, data]) => ({
      name,
      mentions: data.mentions,
      first_pos_ratio: textLength > 0 ? data.first_position / textLength : 0
    }));
  }

  /**
   * Validate if a term could be a legitimate brand name
   */
  private isValidBrandName(name: string): boolean {
    const normalized = name.toLowerCase().trim();
    
    // Length check
    if (normalized.length < 3 || normalized.length > 30) {
      return false;
    }

    // Must start with capital letter (original name, not normalized)
    if (!/^[A-Z]/.test(name)) {
      return false;
    }

    // Check stopwords
    if (STOPWORDS.has(normalized)) {
      return false;
    }

    // Reject purely numeric
    if (/^[0-9]+$/.test(normalized)) {
      return false;
    }

    // Reject problematic characters
    if (/[<>{}[\]()"`''""''„"‚'']/.test(normalized)) {
      return false;
    }

    // Reject obvious spam/generic patterns
    const spamPatterns = [
      'click here', 'learn more', 'sign up', 'get started', 'find out',
      'read more', 'see more', 'view all', 'download now', 'try now',
      'contact us', 'about us', 'privacy policy', 'terms of service'
    ];
    
    if (spamPatterns.some(pattern => normalized.includes(pattern))) {
      return false;
    }

    // Reject single generic words (unless they have specific brand indicators)
    if (!normalized.includes(' ') && !normalized.includes('.') && !normalized.includes('-')) {
      // Single words must be at least 4 characters and not in extended stopwords
      if (normalized.length < 4) {
        return false;
      }
      
      // Allow well-known single-word brand patterns
      const singleWordExceptions = /^(adobe|apple|google|microsoft|amazon|meta|zoom|slack|asana|notion|trello)$/i;
      if (!singleWordExceptions.test(normalized)) {
        // For other single words, be more strict
        const commonSingleWords = [
          'marketing', 'sales', 'business', 'software', 'platform', 'solution',
          'service', 'system', 'tool', 'product', 'company', 'team', 'project',
          'campaign', 'strategy', 'process', 'management', 'development', 'design',
          'analytics', 'data', 'content', 'digital', 'online', 'mobile', 'web'
        ];
        
        if (commonSingleWords.includes(normalized)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Perform NER extraction using OpenAI for organization entities
   */
  private async performNERExtraction(text: string, candidates: string[]): Promise<CompetitorMatch[]> {
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      console.log('⚠️ OpenAI API key not available for NER fallback');
      return [];
    }

    try {
      console.log('🤖 Performing NER extraction for candidates:', candidates);
      
      const prompt = `Analyze the following text and identify which of these candidate terms are actual company/organization names (brands, businesses, software companies, services):

Candidates to evaluate: ${candidates.join(', ')}

Text to analyze:
"""
${text.substring(0, 2000)}
"""

Return ONLY a JSON array of company/organization names from the candidates list that appear in the text and are legitimate businesses/brands. Do not include generic words, actions, or common nouns.

Example response: ["Salesforce", "HubSpot", "Microsoft"]`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5-nano-2025-08-07',
          messages: [
            { role: 'system', content: 'You are a precise entity extraction system. Only identify legitimate company/brand names.' },
            { role: 'user', content: prompt }
          ],
          max_completion_tokens: 200,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content.trim();
      
      // Parse JSON response
      let nerEntities: string[] = [];
      try {
        nerEntities = JSON.parse(content);
      } catch {
        // Fallback: extract array-like content
        const arrayMatch = content.match(/\[(.*?)\]/);
        if (arrayMatch) {
          nerEntities = arrayMatch[1]
            .split(',')
            .map(s => s.trim().replace(/['"]/g, ''))
            .filter(s => s.length > 0);
        }
      }

      console.log('🤖 NER identified organizations:', nerEntities);

      // Convert to CompetitorMatch objects
      const results: CompetitorMatch[] = [];
      for (const entity of nerEntities) {
        if (candidates.includes(entity)) {
          // Find mentions in original text
          const regex = new RegExp(`\\b${entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
          const matches = Array.from(text.matchAll(regex));
          
          if (matches.length > 0) {
            const firstPosition = matches[0].index || 0;
            results.push({
              name: entity,
              normalized: this.normalizeBrand(entity),
              mentions: matches.length,
              first_pos_ratio: text.length > 0 ? firstPosition / text.length : 0,
              confidence: 0.75, // Lower confidence for NER matches
              source: 'ner'
            });
          }
        }
      }

      return results;

    } catch (error) {
      console.error('❌ NER extraction failed:', error);
      return [];
    }
  }

  /**
   * Normalize brand name for comparison
   */
  private normalizeBrand(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\s*-\s*/g, '-');
  }

  /**
   * Capitalize words properly
   */
  private capitalizeWords(str: string): string {
    return str
      .split(/[\s-]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}

/**
 * Factory function to create and use the detector
 */
export async function detectCompetitors(
  supabase: any,
  orgId: string,
  text: string,
  options?: {
    useNERFallback?: boolean;
    maxCandidates?: number;
    confidenceThreshold?: number;
  }
): Promise<CompetitorDetectionResult> {
  const detector = new EnhancedCompetitorDetector(supabase);
  return detector.detectCompetitors(text, orgId, options);
}