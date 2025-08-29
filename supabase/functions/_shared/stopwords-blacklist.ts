/**
 * Comprehensive Stopwords and Phrase Blacklist
 * Used to filter out generic terms that should never be considered competitors
 */

/**
 * English stopwords - common words that should never be competitors
 */
export const ENGLISH_STOPWORDS = new Set([
  // Articles, prepositions, pronouns
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'about',
  'into', 'through', 'over', 'under', 'above', 'below', 'up', 'down', 'out', 'off', 'away', 'back', 'here', 'there',
  'i', 'me', 'my', 'we', 'us', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'they', 'them', 'their',
  
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
  'provide', 'provides', 'provided', 'providing', 'include', 'includes', 'included', 'including', 'continue', 'continues', 'continued', 'continuing',
  'set', 'sets', 'setting', 'remain', 'remains', 'remained', 'remaining', 'add', 'adds', 'added', 'adding',
  'change', 'changes', 'changed', 'changing', 'lead', 'leads', 'led', 'leading', 'understand', 'understands', 'understood', 'understanding',
  'follow', 'follows', 'followed', 'following', 'stop', 'stops', 'stopped', 'stopping', 'read', 'reads', 'reading',
  'open', 'opens', 'opened', 'opening', 'walk', 'walks', 'walked', 'walking', 'talk', 'talks', 'talked', 'talking',
  'speak', 'speaks', 'spoke', 'spoken', 'speaking', 'allow', 'allows', 'allowed', 'allowing', 'win', 'wins', 'won', 'winning',
  'offer', 'offers', 'offered', 'offering', 'remember', 'remembers', 'remembered', 'remembering', 'love', 'loves', 'loved', 'loving',
  'consider', 'considers', 'considered', 'considering', 'appear', 'appears', 'appeared', 'appearing', 'buy', 'buys', 'bought', 'buying',
  'wait', 'waits', 'waited', 'waiting', 'serve', 'serves', 'served', 'serving', 'send', 'sends', 'sent', 'sending',
  'expect', 'expects', 'expected', 'expecting', 'stay', 'stays', 'stayed', 'staying', 'let', 'lets', 'letting',
  'begin', 'begins', 'began', 'begun', 'beginning', 'keep', 'keeps', 'kept', 'keeping', 'learn', 'learns', 'learned', 'learning',
  'decide', 'decides', 'decided', 'deciding', 'develop', 'develops', 'developed', 'developing', 'carry', 'carries', 'carried', 'carrying',
  'break', 'breaks', 'broke', 'broken', 'breaking', 'reach', 'reaches', 'reached', 'reaching', 'tell', 'tells', 'told', 'telling',
  'increase', 'increases', 'increased', 'increasing', 'return', 'returns', 'returned', 'returning', 'explain', 'explains', 'explained', 'explaining',
  'focus', 'focuses', 'focused', 'focusing', 'choose', 'chooses', 'chose', 'chosen', 'choosing',
  
  // Common nouns
  'time', 'person', 'year', 'way', 'day', 'thing', 'man', 'world', 'life', 'hand', 'part', 'child', 'eye', 'woman', 'place',
  'work', 'week', 'case', 'point', 'government', 'company', 'number', 'group', 'problem', 'fact', 'business', 'service',
  'money', 'story', 'lot', 'water', 'book', 'month', 'right', 'study', 'people', 'word', 'issue', 'side', 'kind', 'head',
  'house', 'area', 'country', 'question', 'school', 'interest', 'state', 'power', 'policy', 'help', 'line', 'music',
  'market', 'name', 'idea', 'body', 'information', 'back', 'parent', 'face', 'others', 'level', 'office', 'door',
  'health', 'person', 'art', 'war', 'history', 'party', 'result', 'change', 'morning', 'reason', 'research', 'girl', 'guy',
  'moment', 'air', 'teacher', 'force', 'education', 'experience', 'job', 'book', 'end', 'community', 'system', 'program',
  'home', 'room', 'mother', 'area', 'age', 'policy', 'everything', 'love', 'process', 'music', 'sense', 'nation', 'plan',
  'college', 'interest', 'death', 'course', 'someone', 'experience', 'behind', 'reach', 'local', 'kill', 'six', 'remain',
  'effect', 'use', 'yeah', 'suggest', 'class', 'control', 'raise', 'care', 'perhaps', 'little', 'late', 'hard', 'field',
  'else', 'pass', 'former', 'sell', 'major', 'sometimes', 'require', 'along', 'development', 'themselves', 'report', 'role',
  'better', 'economic', 'effort', 'up', 'decide', 'rate', 'strong', 'possible', 'heart', 'drug', 'show', 'leader', 'light',
  'voice', 'wife', 'whole', 'police', 'mind', 'finally', 'pull', 'return', 'free', 'military', 'price', 'less', 'according',
  'decision', 'explain', 'son', 'hope', 'even', 'develop', 'view', 'relationship', 'carry', 'town', 'road', 'drive', 'arm',
  'true', 'federal', 'break', 'better', 'difference', 'thank', 'receive', 'value', 'international', 'building', 'action',
  'full', 'model', 'join', 'season', 'society', 'because', 'tax', 'director', 'early', 'position', 'player', 'agree',
  'especially', 'record', 'pick', 'wear', 'paper', 'special', 'space', 'ground', 'form', 'support', 'event', 'official',
  'whose', 'matter', 'everyone', 'center', 'couple', 'site', 'project', 'hit', 'base', 'activity', 'star', 'table', 'court',
  'produce', 'eat', 'teach', 'oil', 'half', 'situation', 'easy', 'cost', 'industry', 'figure', 'face', 'street', 'image',
  'itself', 'phone', 'either', 'data', 'cover', 'quite', 'picture', 'clear', 'practice', 'piece', 'land', 'recent',
  'describe', 'product', 'doctor', 'wall', 'patient', 'worker', 'news', 'test', 'movie', 'certain', 'north', 'personal',
  'simply', 'third', 'technology', 'catch', 'step', 'baby', 'computer', 'type', 'attention', 'draw', 'film', 'republican',
  'tree', 'source', 'red', 'nearly', 'organization', 'choose', 'cause', 'hair', 'century', 'evidence', 'window', 'difficult',
  'listen', 'soon', 'culture', 'billion', 'chance', 'brother', 'energy', 'period', 'course', 'summer', 'less', 'realize',
  'hundred', 'available', 'plant', 'likely', 'opportunity', 'term', 'short', 'letter', 'condition', 'choice', 'place', 'single',
  'rule', 'daughter', 'administration', 'south', 'husband', 'congress', 'floor', 'campaign', 'material', 'population', 'well',
  'call', 'economy', 'medical', 'hospital', 'church', 'close', 'thousand', 'risk', 'current', 'fire', 'future', 'wrong',
  'involve', 'defense', 'anyone', 'increase', 'security', 'bank', 'myself', 'certainly', 'west', 'sport', 'board', 'seek',
  'per', 'subject', 'officer', 'private', 'rest', 'behavior', 'deal', 'performance', 'fight', 'throw', 'top', 'quickly',
  'past', 'goal', 'bed', 'order', 'author', 'fill', 'represent', 'focus', 'foreign', 'drop', 'plan', 'blood', 'upon',
  'agency', 'push', 'nature', 'color', 'no', 'recently', 'store', 'reduce', 'sound', 'note', 'fine', 'before', 'near',
  'movement', 'page', 'enter', 'share', 'than', 'common', 'poor', 'other', 'natural', 'race', 'concern', 'series',
  'significant', 'similar', 'hot', 'language', 'each', 'usually', 'response', 'dead', 'rise', 'animal', 'factor', 'decade',
  'article', 'shoot', 'east', 'save', 'seven', 'artist', 'away', 'scene', 'stock', 'career', 'despite', 'central', 'eight',
  'thus', 'treatment', 'beyond', 'happy', 'exactly', 'protect', 'approach', 'lie', 'size', 'dog', 'fund', 'serious', 'occur',
  'media', 'ready', 'sign', 'thought', 'list', 'individual', 'simple', 'quality', 'pressure', 'accept', 'answer', 'hard',
  'resource', 'identify', 'left', 'meeting', 'determine', 'prepare', 'disease', 'whatever', 'success', 'argue', 'cup',
  'particularly', 'amount', 'ability', 'staff', 'recognize', 'indicate', 'character', 'growth', 'loss', 'degree', 'wonder',
  'attack', 'herself', 'region', 'television', 'box', 'tv', 'training', 'pretty', 'trade', 'deal', 'election', 'everybody',
  'physical', 'lay', 'general', 'feeling', 'standard', 'bill', 'message', 'fail', 'outside', 'arrive', 'analysis', 'benefit',
  'name', 'sex', 'forward', 'lawyer', 'present', 'section', 'environmental', 'glass', 'answer', 'skill', 'sister', 'pm',
  'professor', 'operation', 'financial', 'crime', 'stage', 'ok', 'compare', 'authority', 'miss', 'design', 'sort', 'one',
  'act', 'ten', 'knowledge', 'gun', 'station', 'blue', 'state', 'strategy', 'little', 'clearly', 'discuss', 'indeed',
  'force', 'truth', 'song', 'example', 'democratic', 'check', 'environment', 'leg', 'dark', 'public', 'various', 'rather',
  'laugh', 'guess', 'executive', 'set', 'study', 'prove', 'hang', 'entire', 'rock', 'forget', 'claim', 'remove', 'manager',
  'enjoy', 'network', 'legal', 'religious', 'cold', 'form', 'final', 'main', 'science', 'green', 'memory', 'card', 'above',
  'seat', 'cell', 'establish', 'nice', 'trial', 'expert', 'that', 'spring', 'firm', 'democrat', 'radio', 'visit',
  'management', 'care', 'avoid', 'imagine', 'tonight', 'huge', 'ball', 'no', 'close', 'finish', 'yourself', 'talk', 'theory',
  'impact', 'respond', 'statement', 'maintain', 'charge', 'popular', 'traditional', 'onto', 'reveal', 'direction', 'weapon',
  'employee', 'cultural', 'contain', 'peace', 'head', 'control', 'base', 'pain', 'apply', 'play', 'measure', 'wide', 'shake',
  'fly', 'interview', 'manage', 'chair', 'fish', 'particular', 'camera', 'structure', 'politics', 'perform', 'bit', 'weight',
  'suddenly', 'discover', 'candidate', 'top', 'production', 'treat', 'trip', 'evening', 'affect', 'inside', 'conference',
  'unit', 'best', 'style', 'adult', 'worry', 'range', 'mention', 'rather', 'far', 'deep', 'front', 'edge', 'individual',
  'specific', 'writer', 'trouble', 'necessary', 'throughout', 'challenge', 'fear', 'shoulder', 'institution', 'middle', 'sea',
  'dream', 'bar', 'beautiful', 'property', 'instead', 'improve', 'stuff',
  
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

  // Process/action words commonly misidentified
  'making', 'doing', 'going', 'coming', 'getting', 'having', 'being', 'saying', 'knowing', 'thinking', 'looking',
  'seeming', 'feeling', 'becoming', 'leaving', 'trying', 'asking', 'needing', 'wanting', 'turning', 'starting',
  'showing', 'playing', 'running', 'moving', 'living', 'believing', 'holding', 'bringing', 'happening', 'writing',
  'providing', 'sitting', 'standing', 'losing', 'paying', 'meeting', 'including', 'continuing', 'setting',
  'remaining', 'adding', 'changing', 'leading', 'understanding', 'watching', 'following', 'stopping', 'reading',
  'opening', 'walking', 'talking', 'speaking', 'allowing', 'winning', 'offering', 'remembering', 'loving',
  'considering', 'appearing', 'buying', 'waiting', 'serving', 'dying', 'sending', 'expecting', 'staying',
  'letting', 'beginning', 'keeping', 'learning', 'deciding', 'developing', 'carrying', 'breaking', 'reaching',
  'telling', 'increasing', 'returning', 'explaining', 'focusing', 'choosing',
]);

/**
 * Business and technology generic terms that should never be competitors
 */
export const BUSINESS_GENERIC_TERMS = new Set([
  // Generic technology terms
  'solution', 'solutions', 'platform', 'platforms', 'software', 'application', 'applications', 'system', 'systems',
  'tool', 'tools', 'service', 'services', 'product', 'products', 'technology', 'technologies', 'digital', 'online',
  'cloud', 'web', 'mobile', 'app', 'apps', 'website', 'websites', 'internet', 'network', 'networks', 'data',
  'database', 'databases', 'server', 'servers', 'client', 'clients', 'user', 'users', 'customer', 'customers',
  'api', 'apis', 'interface', 'interfaces', 'framework', 'frameworks', 'library', 'libraries',
  
  // Generic business terms
  'business', 'businesses', 'company', 'companies', 'organization', 'organizations', 'enterprise', 'enterprises',
  'management', 'marketing', 'sales', 'support', 'development', 'design', 'analytics', 'analysis', 'report',
  'reports', 'dashboard', 'dashboards', 'integration', 'integrations', 'automation', 'workflow', 'workflows',
  'process', 'processes', 'feature', 'features', 'function', 'functions', 'module', 'modules', 'component',
  'components', 'experience', 'performance', 'optimization', 'security', 'privacy', 'compliance', 'collaboration',
  'communication', 'productivity', 'efficiency', 'scalability', 'reliability', 'availability', 'flexibility',
  'usability', 'accessibility', 'compatibility', 'functionality', 'capability', 'capacity', 'quality', 'innovation',
  'transformation', 'intelligence', 'insights', 'engagement', 'conversion', 'roi', 'kpi', 'metrics', 'tracking',
  'monitoring', 'reporting', 'visualization', 'personalization', 'customization', 'optimization',
  
  // Marketing terms
  'campaign', 'campaigns', 'audience', 'audiences', 'segment', 'segments', 'content', 'contents', 'email', 'emails',
  'newsletter', 'newsletters', 'blog', 'blogs', 'social', 'media', 'post', 'posts', 'video', 'videos', 'image',
  'images', 'photo', 'photos', 'graphic', 'graphics', 'design', 'designs', 'brand', 'brands', 'branding',
  'identity', 'logo', 'logos', 'website', 'websites', 'landing', 'page', 'pages', 'form', 'forms', 'survey',
  'surveys', 'poll', 'polls', 'quiz', 'quizzes', 'lead', 'leads', 'prospect', 'prospects', 'contact', 'contacts',
  'list', 'lists', 'segment', 'segments', 'tag', 'tags', 'category', 'categories', 'keyword', 'keywords',
  'seo', 'sem', 'ppc', 'cpc', 'cpm', 'ctr', 'impression', 'impressions', 'click', 'clicks', 'view', 'views',
  'visit', 'visits', 'visitor', 'visitors', 'traffic', 'organic', 'paid', 'social', 'direct', 'referral',
  'bounce', 'session', 'sessions', 'conversion', 'conversions', 'goal', 'goals', 'funnel', 'funnels',
  'attribution', 'journey', 'touchpoint', 'touchpoints',
  
  // Sales terms
  'lead', 'leads', 'prospect', 'prospects', 'opportunity', 'opportunities', 'deal', 'deals', 'pipeline',
  'forecast', 'quota', 'target', 'targets', 'revenue', 'sales', 'selling', 'buyer', 'buyers', 'seller',
  'sellers', 'vendor', 'vendors', 'supplier', 'suppliers', 'partner', 'partners', 'channel', 'channels',
  'distribution', 'retail', 'wholesale', 'reseller', 'resellers', 'affiliate', 'affiliates', 'commission',
  'margin', 'profit', 'loss', 'cost', 'price', 'pricing', 'discount', 'promotion', 'offer', 'offers',
  'contract', 'agreement', 'terms', 'conditions', 'negotiation', 'closing', 'follow', 'followup',
  
  // Support/service terms
  'support', 'service', 'help', 'assistance', 'ticket', 'tickets', 'case', 'cases', 'issue', 'issues',
  'problem', 'problems', 'question', 'questions', 'answer', 'answers', 'solution', 'solutions', 'resolution',
  'chat', 'call', 'phone', 'email', 'message', 'messages', 'notification', 'notifications', 'alert', 'alerts',
  'reminder', 'reminders', 'feedback', 'review', 'reviews', 'rating', 'ratings', 'satisfaction', 'nps',
  'survey', 'surveys', 'knowledge', 'base', 'documentation', 'guide', 'guides', 'tutorial', 'tutorials',
  'training', 'onboarding', 'setup', 'configuration', 'installation', 'implementation', 'deployment',
  
  // File/document terms
  'file', 'files', 'document', 'documents', 'folder', 'folders', 'directory', 'directories', 'upload',
  'download', 'import', 'export', 'backup', 'restore', 'sync', 'synchronization', 'share', 'sharing',
  'permission', 'permissions', 'access', 'security', 'login', 'logout', 'signin', 'signup', 'register',
  'registration', 'account', 'accounts', 'profile', 'profiles', 'setting', 'settings', 'preference',
  'preferences', 'configuration', 'admin', 'administrator', 'user', 'users', 'member', 'members',
  'team', 'teams', 'group', 'groups', 'role', 'roles', 'permission', 'permissions',
]);

/**
 * Marketing automation and generic category phrases that should be blacklisted
 */
export const GENERIC_CATEGORY_PHRASES = new Set([
  // Marketing automation phrases
  'marketing automation', 'email automation', 'marketing platform', 'email platform', 'automation platform',
  'marketing software', 'email software', 'automation software', 'marketing solution', 'email solution',
  'automation solution', 'marketing system', 'email system', 'automation system', 'marketing tools',
  'email tools', 'automation tools', 'marketing service', 'email service', 'automation service',
  
  // CRM and sales phrases
  'customer relationship management', 'crm platform', 'crm software', 'crm solution', 'crm system',
  'crm tools', 'crm service', 'sales platform', 'sales software', 'sales solution', 'sales system',
  'sales tools', 'sales service', 'lead management', 'contact management', 'pipeline management',
  'sales automation', 'lead generation', 'lead nurturing', 'sales tracking', 'sales reporting',
  
  // Analytics phrases
  'analytics platform', 'analytics software', 'analytics solution', 'analytics system', 'analytics tools',
  'analytics service', 'data analytics', 'web analytics', 'marketing analytics', 'sales analytics',
  'customer analytics', 'business analytics', 'reporting platform', 'reporting software', 'reporting solution',
  'reporting system', 'reporting tools', 'reporting service', 'dashboard platform', 'dashboard software',
  'dashboard solution', 'dashboard system', 'dashboard tools', 'dashboard service',
  
  // Customer data phrases
  'customer data', 'customer information', 'customer database', 'customer records', 'customer profiles',
  'customer insights', 'customer intelligence', 'customer segmentation', 'customer targeting',
  'customer personalization', 'customer experience', 'customer journey', 'customer lifecycle',
  'customer retention', 'customer acquisition', 'customer engagement', 'customer satisfaction',
  
  // Content marketing phrases
  'content marketing', 'content management', 'content creation', 'content strategy', 'content planning',
  'content calendar', 'content scheduling', 'content publishing', 'content distribution', 'content optimization',
  'content analytics', 'content performance', 'content roi', 'content engagement', 'content conversion',
  
  // Social media phrases
  'social media', 'social marketing', 'social management', 'social scheduling', 'social publishing',
  'social monitoring', 'social listening', 'social engagement', 'social analytics', 'social reporting',
  'social automation', 'social tools', 'social platform', 'social software', 'social solution',
  
  // SEO and digital marketing phrases
  'search engine optimization', 'seo tools', 'seo platform', 'seo software', 'seo solution', 'seo service',
  'digital marketing', 'online marketing', 'internet marketing', 'web marketing', 'inbound marketing',
  'outbound marketing', 'performance marketing', 'growth marketing', 'conversion optimization',
  'landing page optimization', 'email marketing', 'affiliate marketing', 'influencer marketing',
  
  // Project management phrases
  'project management', 'task management', 'workflow management', 'collaboration tools', 'team collaboration',
  'productivity tools', 'productivity platform', 'productivity software', 'productivity solution',
  'project tracking', 'time tracking', 'resource management', 'team management', 'workspace management',
  
  // Communication phrases
  'communication platform', 'communication tools', 'messaging platform', 'chat platform', 'video conferencing',
  'web conferencing', 'online meetings', 'virtual meetings', 'team communication', 'internal communication',
  'external communication', 'customer communication', 'business communication',
  
  // Integration and automation phrases
  'integration platform', 'integration tools', 'workflow automation', 'business automation', 'process automation',
  'task automation', 'data integration', 'api integration', 'system integration', 'app integration',
  'software integration', 'platform integration', 'automation workflows', 'automated processes',
  
  // Generic business phrases
  'business intelligence', 'business analytics', 'business automation', 'business management', 'business software',
  'business platform', 'business solution', 'business system', 'business tools', 'business service',
  'enterprise software', 'enterprise platform', 'enterprise solution', 'enterprise system', 'enterprise tools',
  'enterprise service', 'cloud platform', 'cloud software', 'cloud solution', 'cloud system', 'cloud tools',
  'cloud service', 'saas platform', 'saas software', 'saas solution', 'saas system', 'saas tools', 'saas service',
]);

/**
 * Check if a term is a generic English stopword
 */
export function isEnglishStopword(term: string): boolean {
  return ENGLISH_STOPWORDS.has(term.toLowerCase().trim());
}

/**
 * Check if a term is a generic business/technology term
 */
export function isBusinessGenericTerm(term: string): boolean {
  return BUSINESS_GENERIC_TERMS.has(term.toLowerCase().trim());
}

/**
 * Check if a phrase matches a generic category phrase
 */
export function isGenericCategoryPhrase(phrase: string): boolean {
  return GENERIC_CATEGORY_PHRASES.has(phrase.toLowerCase().trim());
}

/**
 * Check if a term should be blacklisted (any type of stopword or generic term)
 */
export function isBlacklisted(term: string): boolean {
  const normalized = term.toLowerCase().trim();
  
  return (
    isEnglishStopword(normalized) ||
    isBusinessGenericTerm(normalized) ||
    isGenericCategoryPhrase(normalized)
  );
}

/**
 * Get all blacklisted terms as a single set for performance
 */
export function getAllBlacklistedTerms(): Set<string> {
  const allTerms = new Set<string>();
  
  // Add all English stopwords
  for (const term of ENGLISH_STOPWORDS) {
    allTerms.add(term);
  }
  
  // Add all business generic terms
  for (const term of BUSINESS_GENERIC_TERMS) {
    allTerms.add(term);
  }
  
  // Add all generic category phrases
  for (const phrase of GENERIC_CATEGORY_PHRASES) {
    allTerms.add(phrase);
  }
  
  return allTerms;
}