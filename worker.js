// ============================================
// JURISPRUDENCE AI SEARCH - Cloudflare Worker
// ============================================

import { Router } from 'itty-router';
import { sign, verify } from 'jose';

const router = Router();
const JWT_SECRET = new TextEncoder().encode(
  globalThis.JWT_SECRET || 'your-secret-key-change-in-production'
);

// ============================================
// MIDDLEWARE
// ============================================
const withAuth = (handler) => {
  return async (request, env) => {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const token = authHeader.slice(7);
    try {
      const verified = await verify(token, JWT_SECRET);
      request.user = verified;
      return handler(request, env);
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401 });
    }
  };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const withCors = (response) => {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
};

// ============================================
// DATABASE UTILITIES
// ============================================
const initDatabase = async (db) => {
  const schema = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      plan TEXT DEFAULT 'free-trial',
      status TEXT DEFAULT 'active',
      started_at TEXT DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS search_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      query TEXT NOT NULL,
      result_count INTEGER,
      execution_time_ms INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      service TEXT NOT NULL,
      key_value TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      rotated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS verified_cases (
      id TEXT PRIMARY KEY,
      gr_number TEXT UNIQUE NOT NULL,
      case_title TEXT NOT NULL,
      date_of_decision TEXT,
      court TEXT,
      codal_provisions TEXT,
      quoted_portion TEXT,
      source_url TEXT,
      embedding BLOB,
      verified_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `;
  // Note: Schema creation would be run during deployment
  return db;
};

// ============================================
// AUTHENTICATION ENDPOINTS
// ============================================

// Sign Up
router.post('/api/auth/signup', async (request, env) => {
  try {
    const { email, password, name } = await request.json();

    // Hash password (simplified - use bcrypt in production)
    const passwordHash = await hashPassword(password);

    // Insert user
    const userId = crypto.randomUUID();
    await env.DB.prepare(
      'INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)'
    ).bind(userId, email, passwordHash, name).run();

    // Create free trial subscription (15 days)
    const subscriptionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
    await env.DB.prepare(
      'INSERT INTO subscriptions (id, user_id, plan, expires_at) VALUES (?, ?, ?, ?)'
    ).bind(subscriptionId, userId, 'free-trial', expiresAt).run();

    // Create JWT token
    const token = await sign(
      { userId, email },
      JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '7d' }
    );

    return withCors(new Response(
      JSON.stringify({ user: { id: userId, email, name }, token }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    ));
  } catch (error) {
    console.error('Signup error:', error);
    return withCors(new Response(
      JSON.stringify({ error: 'Signup failed' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    ));
  }
});

// Sign In
router.post('/api/auth/signin', async (request, env) => {
  try {
    const { email, password } = await request.json();

    const result = await env.DB.prepare(
      'SELECT id, password_hash, name FROM users WHERE email = ?'
    ).bind(email).first();

    if (!result || !await verifyPassword(password, result.password_hash)) {
      return withCors(new Response(
        JSON.stringify({ error: 'Invalid credentials' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      ));
    }

    const token = await sign(
      { userId: result.id, email },
      JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '7d' }
    );

    return withCors(new Response(
      JSON.stringify({ user: { id: result.id, email, name: result.name }, token }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    ));
  } catch (error) {
    console.error('Signin error:', error);
    return withCors(new Response(
      JSON.stringify({ error: 'Signin failed' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    ));
  }
});

// Get Current User
router.get('/api/auth/me', withAuth(async (request, env) => {
  const user = await env.DB.prepare(
    'SELECT id, email, name FROM users WHERE id = ?'
  ).bind(request.user.userId).first();

  return withCors(new Response(
    JSON.stringify(user),
    { headers: { 'Content-Type': 'application/json' } }
  ));
}));

// ============================================
// SUBSCRIPTION ENDPOINTS
// ============================================

router.get('/api/subscription/status', withAuth(async (request, env) => {
  const subscription = await env.DB.prepare(
    'SELECT plan, expires_at FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
  ).bind(request.user.userId).first();

  const daysRemaining = subscription && subscription.expires_at
    ? Math.ceil((new Date(subscription.expires_at) - new Date()) / (1000 * 60 * 60 * 24))
    : 0;

  return withCors(new Response(
    JSON.stringify({
      plan: subscription?.plan || 'free-trial',
      daysRemaining: Math.max(0, daysRemaining),
      expiresAt: subscription?.expires_at,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  ));
}));

// ============================================
// SEARCH ENDPOINT (RAG Pipeline)
// ============================================

router.post('/api/search', withAuth(async (request, env) => {
  const startTime = Date.now();
  try {
    const { query } = await request.json();

    // 1. CONTEXT ANALYSIS
    const contextAnalysis = await analyzeContext(query, env);

    // 2. HYBRID SEARCH (Vector + Lexical + Live Scrape)
    const searchResults = await performHybridSearch(
      query,
      contextAnalysis,
      env,
      request.user.userId
    );

    // 3. VERIFICATION & CROSS-CHECK
    const verifiedResults = await verifyResults(searchResults, env);

    // 4. AI ANALYSIS
    const aiAnalysis = await generateLegalAnalysis(query, verifiedResults, env);

    // 5. LOG SEARCH
    const executionTime = Date.now() - startTime;
    await logSearch(request.user.userId, query, verifiedResults.length, executionTime, env);

    return withCors(new Response(
      JSON.stringify({
        results: verifiedResults.slice(0, 5), // Return top 5 results
        analysis: aiAnalysis,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    ));
  } catch (error) {
    console.error('Search error:', error);
    return withCors(new Response(
      JSON.stringify({ error: 'Search failed', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    ));
  }
}));

// ============================================
// CORE RAG FUNCTIONS
// ============================================

async function analyzeContext(query, env) {
  // Parse user input for legal concepts, parties, issues
  // This is simplified; in production, use Claude API for NLP
  return {
    legalConcepts: extractConcepts(query),
    codableSections: extractCodalSections(query),
    issues: extractIssues(query),
  };
}

async function performHybridSearch(query, contextAnalysis, env, userId) {
  const results = [];

  // Vector search (semantic)
  const vectorResults = await vectorSearch(query, env);
  results.push(...vectorResults);

  // Lexical search (keyword matching)
  const lexicalResults = await lexicalSearch(query, contextAnalysis, env);
  results.push(...lexicalResults);

  // Live scrape if needed (API fallback for recent cases)
  if (results.length < 3) {
    const scrapeResults = await liveScrapeLawphil(query, env);
    results.push(...scrapeResults);
  }

  // Deduplicate by GR number
  const seen = new Set();
  return results.filter(r => {
    if (seen.has(r.grNumber)) return false;
    seen.add(r.grNumber);
    return true;
  });
}

async function vectorSearch(query, env) {
  // Query Cloudflare Vectorize for semantic matches
  try {
    const queryEmbedding = await getEmbedding(query, env);
    const matches = await env.VECTORIZE.query(queryEmbedding, { topK: 10 });

    return matches.map(m => ({
      grNumber: m.metadata.gr_number,
      caseTitle: m.metadata.case_title,
      dateOfDecision: m.metadata.date_of_decision,
      court: m.metadata.court,
      codalProvisions: m.metadata.codal_provisions,
      quotedPortion: m.metadata.quoted_portion,
      sourceUrl: m.metadata.source_url,
      similarity: m.score,
    }));
  } catch (error) {
    console.error('Vector search error:', error);
    return [];
  }
}

async function lexicalSearch(query, contextAnalysis, env) {
  // SQL search for exact matches
  const terms = query.split(/\s+/).filter(t => t.length > 3);
  const placeholder = terms.map(() => '?').join(',');

  const result = await env.DB.prepare(
    `SELECT * FROM verified_cases WHERE 
     case_title LIKE ? OR quoted_portion LIKE ?
     LIMIT 10`
  ).bind(`%${terms[0]}%`, `%${terms[0]}%`).all();

  return (result.results || []).map(r => ({
    grNumber: r.gr_number,
    caseTitle: r.case_title,
    dateOfDecision: r.date_of_decision,
    court: r.court,
    codalProvisions: r.codal_provisions ? JSON.parse(r.codal_provisions) : [],
    quotedPortion: r.quoted_portion,
    sourceUrl: r.source_url,
  }));
}

async function liveScrapeLawphil(query, env) {
  // Real-time scraping for recent cases
  // In production, integrate with Lawphil API or BeautifulSoup worker
  try {
    const response = await fetch(`https://lawphil.net/search?q=${encodeURIComponent(query)}`);
    // Parse and return results (simplified)
    return [];
  } catch (error) {
    console.error('Lawphil scrape error:', error);
    return [];
  }
}

async function verifyResults(results, env) {
  // Verify G.R. numbers, dates, and case titles against database
  const verified = [];

  for (const result of results) {
    const check = await env.DB.prepare(
      'SELECT id FROM verified_cases WHERE gr_number = ? AND case_title = ?'
    ).bind(result.grNumber, result.caseTitle).first();

    if (check) {
      verified.push({
        ...result,
        verified: true,
        verificationStatus: 'confirmed',
      });
    } else {
      // Flag for manual verification or exclude
      verified.push({
        ...result,
        verified: false,
        verificationStatus: 'pending_review',
      });
    }
  }

  return verified;
}

async function generateLegalAnalysis(query, results, env) {
  // Call Claude API to generate legal analysis
  // Ensure strict anti-hallucination: only cite verified cases
  const verifiedCases = results.filter(r => r.verified);

  if (verifiedCases.length === 0) {
    return {
      summary: 'No verified cases found for your query. Please try different search terms.',
      keyPoints: [],
      applicableProvisions: [],
    };
  }

  const prompt = `
    Based on these verified Philippine Supreme Court cases, provide a concise legal analysis:
    
    Query: ${query}
    
    Verified Cases:
    ${verifiedCases.map(c => `- ${c.caseTitle} (${c.grNumber}): "${c.quotedPortion}"`).join('\n')}
    
    Please provide:
    1. A 3-4 sentence summary of how these cases apply
    2. 3-4 key legal principles
    3. Applicable codal provisions
    
    Do NOT cite cases not in the above list.
  `;

  // Call Claude (integration placeholder)
  const analysis = await callClaudeAPI(prompt, env);

  return {
    summary: analysis.summary || 'Legal analysis generated',
    keyPoints: analysis.keyPoints || [],
    applicableProvisions: analysis.applicableProvisions || [],
  };
}

async function logSearch(userId, query, resultCount, executionTime, env) {
  const logId = crypto.randomUUID();
  await env.DB.prepare(
    'INSERT INTO search_logs (id, user_id, query, result_count, execution_time_ms) VALUES (?, ?, ?, ?, ?)'
  ).bind(logId, userId, query, resultCount, executionTime).run();
}

// ============================================
// API KEY ROTATION
// ============================================

router.get('/api/admin/api-keys', withAuth(async (request, env) => {
  // Verify admin status (simplified)
  if (request.user.role !== 'admin') {
    return withCors(new Response(
      JSON.stringify({ error: 'Forbidden' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    ));
  }

  const keys = await env.DB.prepare('SELECT * FROM api_keys').all();
  return withCors(new Response(
    JSON.stringify(keys),
    { headers: { 'Content-Type': 'application/json' } }
  ));
}));

router.post('/api/admin/api-keys/rotate', withAuth(async (request, env) => {
  if (request.user.role !== 'admin') {
    return withCors(new Response(
      JSON.stringify({ error: 'Forbidden' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    ));
  }

  const { service } = await request.json();
  const newKey = generateRotatedKey();

  const keyId = crypto.randomUUID();
  await env.DB.prepare(
    'INSERT INTO api_keys (id, service, key_value) VALUES (?, ?, ?)'
  ).bind(keyId, service, newKey).run();

  return withCors(new Response(
    JSON.stringify({ id: keyId, service, key: newKey }),
    { headers: { 'Content-Type': 'application/json' } }
  ));
}));

// ============================================
// HELPER FUNCTIONS
// ============================================

async function hashPassword(password) {
  // Use SubtleCrypto in production
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password, hash) {
  const computed = await hashPassword(password);
  return computed === hash;
}

async function getEmbedding(text, env) {
  // Call embedding API (e.g., OpenAI, Anthropic)
  // Placeholder
  return new Float32Array(1536);
}

async function callClaudeAPI(prompt, env) {
  // Integration with Claude API via fetch
  // Returns { summary, keyPoints, applicableProvisions }
  // Placeholder
  return {
    summary: 'Analysis placeholder',
    keyPoints: [],
    applicableProvisions: [],
  };
}

function extractConcepts(query) {
  // NLP to extract legal concepts
  return [];
}

function extractCodalSections(query) {
  // Regex to extract Article numbers, etc.
  return [];
}

function extractIssues(query) {
  // Parse legal issues from query
  return [];
}

function generateRotatedKey() {
  return `key_${crypto.randomUUID()}`;
}

// ============================================
// 404 & OPTIONS
// ============================================

router.options('*', () => withCors(new Response(null, { status: 204 })));
router.all('*', () => withCors(new Response(
  JSON.stringify({ error: 'Not found' }),
  { status: 404, headers: { 'Content-Type': 'application/json' } }
)));

// ============================================
// EXPORT HANDLER
// ============================================

export default {
  fetch: router.handle,
};