// _worker.js — Cloudflare Pages edge worker
// Handles: Dropbox OAuth proxy, redeem codes, static assets.
// This file must be at the repo ROOT. When present, Cloudflare ignores
// the functions/ folder entirely — all routing lives here.

const DROPBOX_APP_KEY  = 'kgy1xf57bh26gsi';
const DROPBOX_REDIRECT = 'https://romplayerbycoops.pages.dev/';
const SUPABASE_URL     = 'https://lsgtujvneyouihoivgyy.supabase.co';
// Public anon key — safe to embed, same one shipped in index.html.
// Used ONLY to validate a caller-supplied access token against Supabase
// Auth; it grants no elevated privileges on its own.
const SUPABASE_ANON    = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzZ3R1anZuZXlvdWlob2l2Z3l5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwOTgwMTIsImV4cCI6MjEwMDY3NDAxMn0.7Qbc1E8ygwUkiEPqugJS3i0vWNkWBrKrPW2ms1VCe6w';

// Only these origins may call the state-changing endpoints below.
// Add a local dev origin here temporarily if you need to test locally
// (e.g. 'http://localhost:8788'), then remove it before shipping.
const ALLOWED_ORIGINS = new Set([
  'https://romplayerbycoops.pages.dev',
]);

function corsHeaders(request) {
  const origin = request.headers.get('Origin');
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'null';
  return {
    'Access-Control-Allow-Origin':  allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
    'Vary': 'Origin',
  };
}

const json = (data, status, CORS) =>
  new Response(JSON.stringify(data), { status, headers: CORS });

const cors204 = (CORS) =>
  new Response(null, { status: 204, headers: CORS });

// ══════════════════════════════════════════════════════
// Auth — verify the caller's Supabase access token ourselves.
// NEVER trust a client-supplied userId. The only identity we ever
// act on is whatever Supabase's own Auth server hands back for the
// bearer token actually presented on this request.
// ══════════════════════════════════════════════════════
async function verifyUser(request) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!token) return null;

  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey': SUPABASE_ANON,
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!r.ok) return null;
    const user = await r.json();
    if (!user || !user.id) return null;
    return user; // { id, email, ... }
  } catch (e) {
    return null;
  }
}

// ══════════════════════════════════════════════════════
// Minimal best-effort rate limiting.
// Real protection should also come from a Cloudflare Rate Limiting
// rule on /redeem-code and /check-premium in the dashboard — that
// enforces at the edge across all isolates. This KV-backed check is
// a defense-in-depth backstop and only activates if a KV namespace
// named RATE_LIMIT is bound; it no-ops otherwise so nothing breaks
// if that binding isn't set up yet.
// ══════════════════════════════════════════════════════
async function rateLimited(env, key, limit, windowSeconds) {
  if (!env.RATE_LIMIT) return false; // KV not bound — skip, rely on dashboard rule
  const k = `rl:${key}`;
  const current = parseInt((await env.RATE_LIMIT.get(k)) || '0', 10);
  if (current >= limit) return true;
  await env.RATE_LIMIT.put(k, String(current + 1), { expirationTtl: windowSeconds });
  return false;
}

function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}

// ══════════════════════════════════════════════════════
// Dropbox OAuth proxy
// ══════════════════════════════════════════════════════
async function handleDropboxAuth(request, CORS) {
  if (request.method === 'OPTIONS') return cors204(CORS);
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, CORS);

  let body;
  try { body = await request.json(); }
  catch (_) { return json({ error: 'Invalid JSON' }, 400, CORS); }

  if (body.action === 'exchange') {
    const { code, verifier } = body;
    if (!code || !verifier) return json({ error: 'Missing code or verifier' }, 400, CORS);
    const r = await fetch('https://api.dropbox.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, grant_type: 'authorization_code',
        client_id: DROPBOX_APP_KEY, redirect_uri: DROPBOX_REDIRECT, code_verifier: verifier,
      }),
    });
    const data = await r.json();
    if (!r.ok || !data.access_token)
      return json({ error: data.error_description || 'Token exchange failed' }, 400, CORS);
    return json({ access_token: data.access_token, refresh_token: data.refresh_token, expires_in: data.expires_in }, 200, CORS);
  }

  if (body.action === 'refresh') {
    const { refresh_token } = body;
    if (!refresh_token) return json({ error: 'Missing refresh_token' }, 400, CORS);
    const r = await fetch('https://api.dropbox.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token', refresh_token, client_id: DROPBOX_APP_KEY,
      }),
    });
    const data = await r.json();
    if (!r.ok || !data.access_token)
      return json({ error: data.error_description || 'Token refresh failed' }, 401, CORS);
    return json({ access_token: data.access_token, expires_in: data.expires_in }, 200, CORS);
  }

  return json({ error: 'Unknown action' }, 400, CORS);
}

// ══════════════════════════════════════════════════════
// Redeem code — single use, grants permanent premium.
// Identity comes ONLY from the verified access token — a client can
// no longer redeem a code onto an arbitrary userId of its choosing.
// ══════════════════════════════════════════════════════
async function handleRedeemCode(request, env, CORS) {
  if (request.method === 'OPTIONS') return cors204(CORS);
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, CORS);

  if (!env.SUPABASE_SERVICE_KEY)
    return json({ error: 'Server misconfiguration — SUPABASE_SERVICE_KEY not set' }, 500, CORS);

  const user = await verifyUser(request);
  if (!user) return json({ error: 'Sign in required' }, 401, CORS);
  const userId = user.id;

  if (await rateLimited(env, `redeem:${clientIp(request)}`, 10, 60))
    return json({ error: 'Too many attempts — try again in a minute' }, 429, CORS);
  if (await rateLimited(env, `redeem:user:${userId}`, 10, 60))
    return json({ error: 'Too many attempts — try again in a minute' }, 429, CORS);

  let codeHash;
  try { ({ codeHash } = await request.json()); }
  catch (_) { return json({ error: 'Invalid JSON' }, 400, CORS); }

  if (!codeHash || typeof codeHash !== 'string' || !/^[a-f0-9]{64}$/i.test(codeHash))
    return json({ error: 'Missing or malformed codeHash' }, 400, CORS);

  const sb = {
    'Content-Type': 'application/json',
    'apikey': env.SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    'Prefer': 'return=representation',
  };

  // 1. Find the code
  const lookupRes = await fetch(
    `${SUPABASE_URL}/rest/v1/redeem_codes?code_hash=eq.${encodeURIComponent(codeHash)}&select=id,used_by&limit=1`,
    { headers: sb }
  );
  const rows = await lookupRes.json();

  if (!Array.isArray(rows) || rows.length === 0)
    return json({ error: 'Code not found' }, 404, CORS);

  const row = rows[0];

  // Already used by someone else
  if (row.used_by && row.used_by !== userId)
    return json({ error: 'Code already used' }, 409, CORS);

  // If already used by this same user — still grant premium (idempotent)
  if (!row.used_by) {
    // 2. Mark as used atomically
    const markRes = await fetch(
      `${SUPABASE_URL}/rest/v1/redeem_codes?id=eq.${encodeURIComponent(row.id)}&used_by=is.null`,
      {
        method: 'PATCH',
        headers: sb,
        body: JSON.stringify({ used_by: userId, used_at: new Date().toISOString() }),
      }
    );
    const marked = await markRes.json();
    // If nothing was updated, someone else just used it simultaneously
    if (!Array.isArray(marked) || marked.length === 0)
      return json({ error: 'Code already used' }, 409, CORS);
  }

  // 3. Grant premium — upsert so it works even if profile row doesn't exist yet
  const grantRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
    {
      method: 'PATCH',
      headers: sb,
      body: JSON.stringify({ is_premium: true, premium_source: 'redeem', updated_at: new Date().toISOString() }),
    }
  );

  if (!grantRes.ok) {
    const err = await grantRes.text();
    console.error('[redeem] grantPremium failed:', err);
    return json({ error: 'Failed to grant premium — try again' }, 500, CORS);
  }

  return json({ ok: true }, 200, CORS);
}

// ══════════════════════════════════════════════════════
// Check premium — service key bypasses RLS entirely.
// Identity comes ONLY from the verified access token — a client can
// no longer ask "is user X premium?" for an arbitrary X.
// ══════════════════════════════════════════════════════
async function handleCheckPremium(request, env, CORS) {
  if (request.method === 'OPTIONS') return cors204(CORS);
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, CORS);
  if (!env.SUPABASE_SERVICE_KEY) return json({ error: 'Misconfigured' }, 500, CORS);

  const user = await verifyUser(request);
  if (!user) return json({ error: 'Sign in required' }, 401, CORS);
  const userId = user.id;

  if (await rateLimited(env, `checkprem:${clientIp(request)}`, 60, 60))
    return json({ error: 'Too many requests' }, 429, CORS);

  const sb = {
    'Content-Type': 'application/json',
    'apikey': env.SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
  };

  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=is_premium&limit=1`,
    { headers: sb }
  );
  const rows = await r.json();

  if (!Array.isArray(rows) || rows.length === 0) {
    // Profile doesn't exist yet — create it
    await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method: 'POST',
      headers: { ...sb, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ id: userId, is_premium: false }),
    });
    return json({ is_premium: false }, 200, CORS);
  }

  return json({ is_premium: rows[0].is_premium || false }, 200, CORS);
}

// ══════════════════════════════════════════════════════
// IGDB Cover Art — proxied server-side, Cloudflare cached
// ══════════════════════════════════════════════════════

// EmulatorJS core → IGDB platform ID
const IGDB_PLATFORM = {
  nes:           18,
  snes:          19,
  gba:           24,
  gb:            33,
  gbc:           22,
  gambatte:      33,  // gambatte core covers both GB (33) and GBC (22) — default to GB platform
  n64:           4,
  nds:           20,
  vb:            87,
  ws:            57,
  wsc:           57,
  segaMD:        29,
  sega32x:       30,
  segaGG:        35,
  segaMS:        64,
  segaCD:        78,
  saturn:        32,
  psx:           7,
  ppsspp:        38,
  pce:           86,
  ngp:           119,
  neogeo:        80,
  a2600:         59,
  lynx:          61,
  coleco:        68,
  msx:           27,
  intellivision: 67,
  vectrex:       71,
};

// In-memory IGDB token cache
let _igdbToken = null;
let _igdbTokenExpiry = 0;

async function getIgdbToken(env) {
  if (_igdbToken && Date.now() < _igdbTokenExpiry - 60000) return _igdbToken;
  const r = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${env.IGDB_CLIENT_ID}&client_secret=${env.IGDB_CLIENT_SECRET}&grant_type=client_credentials`,
    { method: 'POST' }
  );
  if (!r.ok) throw new Error('IGDB token fetch failed: ' + r.status);
  const data = await r.json();
  _igdbToken = data.access_token;
  _igdbTokenExpiry = Date.now() + (data.expires_in * 1000);
  return _igdbToken;
}

// Normalise a game name for fuzzy comparison
function normaliseName(n) {
  return n
    .toLowerCase()
    .replace(/^(the|a|an)\s+/i, '')      // strip leading articles
    .replace(/,\s*(the|a|an)$/i, '')     // strip trailing articles
    .replace(/[^a-z0-9\s]/g, '')         // strip punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

// Levenshtein distance for fuzzy matching
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({length: m+1}, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

// Score a candidate game name against the query — lower is better
function matchScore(query, candidate) {
  const q = normaliseName(query);
  const c = normaliseName(candidate);
  if (c === q) return 0;
  if (c.startsWith(q) || q.startsWith(c)) return 1;
  if (c.includes(q) || q.includes(c)) return 2;
  const dist = levenshtein(q, c);
  const maxLen = Math.max(q.length, c.length);
  return 3 + (dist / maxLen);
}

// Clean a raw ROM filename into a search-friendly name
function cleanForSearch(raw) {
  let n = raw
    .replace(/\.[^.]+$/, '')              // strip extension
    .replace(/\s*[\(\[][^)\]]*[\)\]]/g, '') // strip (tags) [tags]
    .replace(/\s*#.*$/, '')               // strip # suffixes like "# GBA"
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Strip No-Intro junk characters like [!] [b] etc
  n = n.replace(/\[.*?\]/g, '').trim();
  // Normalise roman numeral variants — II→2 etc for search
  return n;
}

async function handleCoverArt(request, env, CORS) {
  if (request.method === 'OPTIONS') return cors204(CORS);
  if (!env.IGDB_CLIENT_ID || !env.IGDB_CLIENT_SECRET)
    return json({ error: 'IGDB not configured' }, 500, CORS);

  const url = new URL(request.url);
  const name = url.searchParams.get('name');
  const core = url.searchParams.get('core');
  if (!name || !core) return json({ error: 'Missing name or core' }, 400, CORS);

  const platformId = IGDB_PLATFORM[core];

  try {
    const token = await getIgdbToken(env);
    const igdbHeaders = {
      'Client-ID': env.IGDB_CLIENT_ID,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'text/plain',
    };

    const cleanName = cleanForSearch(name);
    if (!cleanName) return json({ error: 'Empty name after cleaning' }, 400, CORS);

    // Build search queries — platform-specific first, then broad fallback
    // Also try article-swapped version: "Legend of Zelda, The" → "The Legend of Zelda"
    const articleSwap = cleanName.replace(/^(.+),\s*(the|a|an)$/i, '$2 $1').trim();
    const searchTerms = [...new Set([cleanName, articleSwap])];

    const queries = [];
    for (const term of searchTerms) {
      if (platformId) {
        queries.push(`search "${term}"; fields name,cover.image_id; where platforms = (${platformId}) & cover != null; limit 5;`);
      }
      queries.push(`search "${term}"; fields name,cover.image_id; where cover != null; limit 5;`);
    }

    let bestImageId = null;
    let bestScore = Infinity;

    for (const query of queries) {
      const r = await fetch('https://api.igdb.com/v4/games', {
        method: 'POST', headers: igdbHeaders, body: query,
      });
      if (!r.ok) continue;
      const games = await r.json();
      if (!Array.isArray(games)) continue;

      for (const game of games) {
        if (!game.cover?.image_id) continue;
        const score = matchScore(cleanName, game.name || '');
        if (score < bestScore) {
          bestScore = score;
          bestImageId = game.cover.image_id;
          // Perfect match — stop immediately
          if (score === 0) break;
        }
      }
      // If we have a near-perfect match (score < 2), stop trying more queries
      if (bestScore < 2) break;
    }

    if (!bestImageId) return json({ error: 'Not found' }, 404, CORS);

    // Return the image directly — Cloudflare caches at edge for 30 days
    const imgUrl = `https://images.igdb.com/igdb/image/upload/t_cover_big/${bestImageId}.jpg`;
    const imgRes = await fetch(imgUrl);
    if (!imgRes.ok) return json({ error: 'Image fetch failed' }, 502, CORS);

    return new Response(imgRes.body, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=2592000',
        'Access-Control-Allow-Origin': CORS['Access-Control-Allow-Origin'],
        'X-Cover-Score': String(bestScore),
      },
    });

  } catch(e) {
    console.error('[cover-art]', e.message);
    return json({ error: 'Internal error' }, 500, CORS);
  }
}

// ══════════════════════════════════════════════════════
// Router
// ══════════════════════════════════════════════════════
export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    const CORS = corsHeaders(request);

    // /functions/* paths are kept only so any old cached/bookmarked
    // client build that still calls them keeps working — they route
    // to the exact same hardened handlers, not to functions/redeem-code.js
    // (that file is legacy Cloudflare Pages Functions format, unused
    // and unreachable while this _worker.js exists at the repo root;
    // remove it from the repo to avoid confusion).
    if (pathname === '/dropbox-auth' || pathname === '/functions/dropbox-auth')
      return handleDropboxAuth(request, CORS);

    if (pathname === '/redeem-code' || pathname === '/functions/redeem-code')
      return handleRedeemCode(request, env, CORS);

    if (pathname === '/check-premium')
      return handleCheckPremium(request, env, CORS);

    if (pathname === '/cover-art')
      return handleCoverArt(request, env, CORS);

    return env.ASSETS.fetch(request);
  }
};
