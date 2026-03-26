// ============================================
// api/scrape.js — BHFT Website Checker
// Vercel serverless function
// ============================================
// POST /api/scrape  { url: string }
//
// Returns:
//   robots.txt — what AI crawlers are allowed
//   structuredData — JSON-LD, Open Graph, Schema.org, meta tags
//   scrapedContent — what a bot actually sees
//   clinicalAnalysis — Claude's misrepresentation risk assessment

import Anthropic from '@anthropic-ai/sdk';
import * as cheerio from 'cheerio';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Known AI crawlers to check against robots.txt
const AI_CRAWLERS = [
  { agent: 'GPTBot',             owner: 'OpenAI (ChatGPT)' },
  { agent: 'ChatGPT-User',       owner: 'OpenAI (ChatGPT browsing)' },
  { agent: 'CCBot',              owner: 'Common Crawl (AI training data)' },
  { agent: 'anthropic-ai',       owner: 'Anthropic (Claude)' },
  { agent: 'ClaudeBot',          owner: 'Anthropic (Claude)' },
  { agent: 'Applebot',           owner: 'Apple (Siri / AI features)' },
  { agent: 'Google-Extended',    owner: 'Google (AI training)' },
  { agent: 'Googlebot',          owner: 'Google (Search + AI Overviews)' },
  { agent: 'PerplexityBot',      owner: 'Perplexity AI' },
  { agent: 'cohere-ai',          owner: 'Cohere AI' },
  { agent: 'Meta-ExternalAgent', owner: 'Meta (Llama / AI)' },
  { agent: 'Bytespider',         owner: 'ByteDance / TikTok AI' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

async function fetchWithTimeout(url, ms = 10000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'BHFT-WebsiteChecker/1.0 (educational/research)',
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
      },
    });
  } finally {
    clearTimeout(id);
  }
}

// ─── robots.txt parser ──────────────────────────────────────────────────────

function parseRobotsTxt(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const groups = [];
  let current = null;

  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();

    if (key === 'user-agent') {
      if (current && current.rules.length === 0) {
        current.agents.push(value);
      } else {
        current = { agents: [value], rules: [], crawlDelay: null };
        groups.push(current);
      }
    } else if (current) {
      if (key === 'disallow') current.rules.push({ type: 'disallow', path: value });
      else if (key === 'allow') current.rules.push({ type: 'allow', path: value });
      else if (key === 'crawl-delay') current.crawlDelay = value;
    }
  }

  const sitemaps = lines
    .filter(l => l.toLowerCase().startsWith('sitemap:'))
    .map(l => l.slice(l.indexOf(':') + 1).trim());

  const crawlerAnalysis = AI_CRAWLERS.map(({ agent, owner }) => {
    const specific = groups.find(g => g.agents.some(a => a.toLowerCase() === agent.toLowerCase()));
    const wildcard = groups.find(g => g.agents.includes('*'));
    const group = specific || wildcard;

    if (!group) {
      return { agent, owner, status: 'allowed', blocked: false, details: 'No rules — access permitted by default', usedWildcard: false };
    }

    const fullyBlocked = group.rules.some(r => r.type === 'disallow' && r.path === '/');
    const partialBlock = !fullyBlocked && group.rules.some(r => r.type === 'disallow' && r.path);

    let status, details;
    if (fullyBlocked) {
      status = 'blocked';
      details = 'Fully blocked (Disallow: /)';
    } else if (partialBlock) {
      const paths = group.rules.filter(r => r.type === 'disallow').map(r => r.path).join(', ');
      status = 'partial';
      details = `Partial — blocked paths: ${paths}`;
    } else {
      status = 'allowed';
      details = 'No disallow rules — access permitted';
    }

    return { agent, owner, status, blocked: status === 'blocked', partial: status === 'partial', details, crawlDelay: group.crawlDelay, usedWildcard: !specific && !!wildcard };
  });

  const blocked = crawlerAnalysis.filter(c => c.blocked).length;
  const partial = crawlerAnalysis.filter(c => c.partial).length;

  const overallRating =
    blocked >= 6 ? 'strong' :
    blocked + partial >= 4 ? 'moderate' :
    blocked > 0 ? 'weak' : 'none';

  const overallSummary =
    blocked >= 6 ? `${blocked} of ${AI_CRAWLERS.length} AI crawlers blocked` :
    blocked > 0 ? `${blocked} fully blocked, ${partial} partially restricted — most AI systems have unrestricted access` :
    'No AI crawlers blocked — all content freely accessible to AI systems';

  return { raw: text, sitemaps, crawlerAnalysis, overallRating, overallSummary };
}

// ─── Structured data extractor ──────────────────────────────────────────────

function extractStructuredData($) {
  const jsonLd = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try { jsonLd.push(JSON.parse($(el).html())); } catch {}
  });

  const openGraph = {};
  $('meta[property^="og:"]').each((_, el) => {
    openGraph[$(el).attr('property').replace('og:', '')] = $(el).attr('content');
  });

  const twitterCard = {};
  $('meta[name^="twitter:"]').each((_, el) => {
    twitterCard[$(el).attr('name').replace('twitter:', '')] = $(el).attr('content');
  });

  const metaTags = {
    description: $('meta[name="description"]').attr('content') || null,
    keywords:    $('meta[name="keywords"]').attr('content') || null,
    author:      $('meta[name="author"]').attr('content') || null,
    robots:      $('meta[name="robots"]').attr('content') || null,
    canonical:   $('link[rel="canonical"]').attr('href') || null,
    lastModified:$('meta[name="last-modified"]').attr('content') || null,
    dcDate:      $('meta[name="DC.date"]').attr('content') || null,
    dcCreator:   $('meta[name="DC.creator"]').attr('content') || null,
    dcPublisher: $('meta[name="DC.publisher"]').attr('content') || null,
  };

  const microdata = [];
  $('[itemscope]').each((_, el) => {
    const type = $(el).attr('itemtype');
    if (!type) return;
    const props = {};
    $(el).find('[itemprop]').each((_, p) => {
      props[$(p).attr('itemprop')] = $(p).attr('content') || $(p).text().trim().slice(0, 200);
    });
    microdata.push({ type, props });
  });

  const HEALTH_TYPES = ['MedicalEntity','MedicalCondition','MedicalGuideline','MedicalOrganization',
    'MedicalWebPage','Drug','DietarySupplement','MedicalTrial','Physician','Hospital',
    'MedicalClinic','HealthTopicContent','MedicalCode','SpecialAnnouncement'];

  const hasHealthSchema = jsonLd.some(item => {
    const t = item['@type'];
    return HEALTH_TYPES.some(h => (Array.isArray(t) ? t : [t]).some(v => v?.includes(h)));
  });

  const hasMedicalPublisherInfo = !!(
    metaTags.author || metaTags.dcCreator || metaTags.dcPublisher ||
    jsonLd.some(i => i.author || i.publisher || i.creator)
  );

  const hasDateInfo = !!(
    metaTags.lastModified || metaTags.dcDate ||
    jsonLd.some(i => i.dateModified || i.datePublished || i.dateReviewed)
  );

  const gaps = [
    !hasHealthSchema && 'No medical/health Schema.org type declared',
    !hasMedicalPublisherInfo && 'No author or publisher information in metadata',
    !hasDateInfo && 'No review date or publication date in metadata',
  ].filter(Boolean);

  const schemaScore = (hasHealthSchema ? 40 : 0) + (hasMedicalPublisherInfo ? 30 : 0) + (hasDateInfo ? 30 : 0);

  return { jsonLd, openGraph, twitterCard, metaTags, microdata, schemaAssessment: { hasHealthSchema, hasMedicalPublisherInfo, hasDateInfo, score: schemaScore, gaps } };
}

// ─── Visible text extractor ─────────────────────────────────────────────────

function extractVisibleText($) {
  $('script, style, noscript, iframe, nav, footer, header').remove();

  const title = $('title').text().trim();
  const h1 = $('h1').map((_, el) => $(el).text().trim()).get().filter(Boolean);
  const h2 = $('h2').map((_, el) => $(el).text().trim()).get().filter(Boolean);
  const h3 = $('h3').map((_, el) => $(el).text().trim()).get().filter(Boolean);

  let mainContent = '';
  for (const sel of ['main', 'article', '[role="main"]', '.content', '#content', '.main-content']) {
    const el = $(sel);
    if (el.length) { mainContent = el.text().replace(/\s+/g, ' ').trim(); break; }
  }
  if (!mainContent) mainContent = $('body').text().replace(/\s+/g, ' ').trim();

  const wordCount = mainContent.split(/\s+/).filter(Boolean).length;
  const lists = $('ul, ol').map((_, el) =>
    $(el).find('li').map((_, li) => $(li).text().trim()).get().filter(t => t.length > 5)
  ).get().flat().slice(0, 30);

  return { title, h1, h2, h3, mainContentPreview: mainContent.slice(0, 2000), wordCount, lists };
}

// ─── Claude clinical analysis ───────────────────────────────────────────────

async function analyseWithClaude({ url, robotsData, structuredData, textContent }) {
  const robotsSummary = robotsData
    ? `robots.txt found. Protection: ${robotsData.overallRating}. ${robotsData.overallSummary}.`
    : 'No robots.txt found — all crawlers have unrestricted access.';

  const { schemaAssessment } = structuredData;

  const system = `You are a clinical safety and digital governance expert specialising in how AI systems interact with healthcare website content.

You analyse website content to assess:
1. Whether safety-critical information would survive AI summarisation
2. How this content could be misrepresented by AI systems (ChatGPT, Claude, Perplexity, Google AI Overviews, etc.)
3. Specific patient safety risks from AI-mediated versions of this content
4. Practical recommendations for the website owners

AI summarisers tend to:
- Extract the most concrete, actionable statements
- Drop qualifying language ("always consult your doctor", "this is general guidance only")
- Weight content that appears early in the page
- Ignore footnotes, sidebars, small print, and hedging language
- Condense nuance into the nearest simple statement

You must return ONLY valid JSON matching this exact schema:
{
  "isHealthContent": boolean,
  "contentType": string,
  "clinicalRiskRating": "high" | "medium" | "low" | "none",
  "clinicalRiskRationale": string,
  "aiSummarySimulation": string,
  "survivalAnalysis": {
    "survives": string[],
    "stripped": string[]
  },
  "misrepresentationRisks": [
    { "risk": string, "example": string, "severity": "critical" | "serious" | "moderate" }
  ],
  "robotsTxtAssessment": string,
  "structuredDataAssessment": string,
  "safetyRecommendations": string[],
  "overallVerdict": string
}`;

  const message = `Analyse this URL for AI scraping and clinical safety risk.

URL: ${url}

robots.txt: ${robotsSummary}

Structured data: Health Schema.org type: ${schemaAssessment.hasHealthSchema ? 'YES' : 'NO'} | Author/publisher: ${schemaAssessment.hasMedicalPublisherInfo ? 'YES' : 'NO'} | Date info: ${schemaAssessment.hasDateInfo ? 'YES' : 'NO'}
JSON-LD @types present: ${structuredData.jsonLd.map(j => j['@type']).filter(Boolean).join(', ') || 'none'}

Page title: ${textContent.title}
H1: ${textContent.h1.join(' | ') || 'none'}
H2: ${textContent.h2.slice(0, 8).join(' | ') || 'none'}

Main content (first 5000 chars):
${textContent.mainContentPreview.slice(0, 5000)}

List items extracted:
${textContent.lists.slice(0, 20).join('\n')}

Assess this page. Key questions:
- Would safety caveats survive a 3-sentence AI summary?
- What specific patient harms could result from AI misrepresentation?
- For health/NHS content: are crisis contacts, medication warnings, and clinical thresholds positioned to survive summarisation?`;

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 3000,
    temperature: 0,
    system,
    messages: [{ role: 'user', content: message }],
  });

  const raw = response.content[0]?.text || '';
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}

// ─── Main handler ────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // CORS headers for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'Missing required field: url' });

  let parsedUrl;
  try {
    parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
  } catch {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  const targetUrl = parsedUrl.href;
  const origin = parsedUrl.origin;
  const startTime = Date.now();

  console.log(`[BHFT Checker] Analysing: ${targetUrl}`);

  try {
    // 1. Fetch robots.txt
    let robotsTxt = { found: false, raw: null, parsed: null };
    try {
      const r = await fetchWithTimeout(`${origin}/robots.txt`);
      if (r.ok) {
        const text = await r.text();
        if (text.toLowerCase().includes('user-agent')) {
          robotsTxt = { found: true, raw: text, parsed: parseRobotsTxt(text) };
        }
      }
    } catch (e) {
      console.log(`robots.txt fetch failed: ${e.message}`);
    }

    // 2. Fetch the page
    let pageHtml = '';
    let fetchError = null;
    try {
      const r = await fetchWithTimeout(targetUrl);
      if (!r.ok) {
        fetchError = `HTTP ${r.status} ${r.statusText}`;
      } else {
        pageHtml = await r.text();
      }
    } catch (e) {
      fetchError = e.name === 'AbortError' ? 'Request timed out after 10s' : e.message;
    }

    if (!pageHtml) {
      return res.status(422).json({ error: `Could not fetch the page: ${fetchError}`, robotsTxt });
    }

    // 3. Parse HTML
    const $ = cheerio.load(pageHtml);
    const structuredData = extractStructuredData($);
    const scrapedContent = extractVisibleText($);

    // 4. Claude analysis
    let clinicalAnalysis = null;
    let analysisError = null;
    try {
      clinicalAnalysis = await analyseWithClaude({ url: targetUrl, robotsData: robotsTxt.parsed, structuredData, textContent: scrapedContent });
    } catch (e) {
      analysisError = e.message;
      console.error(`Claude analysis failed: ${e.message}`);
    }

    res.status(200).json({
      url: targetUrl,
      fetchedAt: new Date().toISOString(),
      robotsTxt,
      structuredData,
      scrapedContent,
      clinicalAnalysis,
      analysisError,
      durationMs: Date.now() - startTime,
    });

  } catch (e) {
    console.error(`Unexpected error: ${e.message}`);
    res.status(500).json({ error: 'Analysis failed', message: e.message });
  }
}
