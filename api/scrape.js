import Anthropic from '@anthropic-ai/sdk';
import * as cheerio from 'cheerio';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function fetchHtml(url, timeoutMs = 8000) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HealthcareAIChecker/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (_) { return null; }
}

// ─── Page parser ─────────────────────────────────────────────────────────────

function parsePage(html, url) {
  const $ = cheerio.load(html);
  const title = $('title').text().trim();

  const metaTags = {};
  $('meta').each((_, el) => {
    const name = $(el).attr('name') || $(el).attr('property');
    const content = $(el).attr('content');
    if (name && content) metaTags[name] = content;
  });

  const structuredData = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try { structuredData.push(JSON.parse($(el).html() || '')); } catch (_) {}
  });

  // Collect internal links
  const baseHost = new URL(url).hostname;
  const links = new Set();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    try {
      const abs = href.startsWith('http') ? href : new URL(href, url).href;
      const host = new URL(abs).hostname;
      if (host === baseHost && !abs.includes('#') && !abs.match(/\.(pdf|jpg|png|gif|css|js|xml|zip|doc|docx)$/i)) {
        links.add(abs);
      }
    } catch (_) {}
  });

  $('script, style, nav, footer, header, .cookie-banner, .skip-link, [aria-hidden="true"]').remove();
  const text = $('body').text().replace(/\s+/g, ' ').trim().substring(0, 2500);

  return { title, metaTags, structuredData, text, links: [...links] };
}

// ─── Clinical relevance scoring ───────────────────────────────────────────────

const CLINICAL_KEYWORDS = [
  'service', 'patient', 'clinic', 'health', 'treatment', 'condition', 'care',
  'mental', 'ward', 'referral', 'appointment', 'emergency', 'medicine', 'drug',
  'therapy', 'support', 'advice', 'information', 'symptom', 'diagnosis',
  'medication', 'assessment', 'inpatient', 'outpatient', 'crisis', 'wellbeing',
  'recovery', 'community', 'child', 'adult', 'older', 'dementia', 'anxiety',
  'depression', 'eating-disorder', 'autism', 'learning-disabilit',
];
const SKIP_PATTERNS = [
  /\/(login|search\?|print|share|cookie|privacy|terms|sitemap|staff|job|career|news|press|media|freedom|foi|contact|about|vacancies|board|governance|annual|report)\b/i,
  /\?.*page=/i,
];

function scoreUrl(url) {
  if (SKIP_PATTERNS.some(p => p.test(url))) return -1;
  const lower = url.toLowerCase();
  return CLINICAL_KEYWORDS.reduce((s, kw) => lower.includes(kw) ? s + 1 : s, 0);
}

// ─── Sitemap crawler ──────────────────────────────────────────────────────────

async function getSitemapUrls(baseUrl, hostname) {
  const candidates = [
    `${baseUrl}/sitemap.xml`,
    `${baseUrl}/sitemap_index.xml`,
    `${baseUrl}/sitemap/`,
    `${baseUrl}/sitemap`,
  ];
  for (const sm of candidates) {
    const xml = await fetchHtml(sm, 6000);
    if (!xml) continue;
    // Handle sitemap index — fetch child sitemaps
    const indexMatches = xml.match(/<sitemap>[\s\S]*?<loc>(.*?)<\/loc>[\s\S]*?<\/sitemap>/g) || [];
    let allUrls = [];
    if (indexMatches.length > 0) {
      // Fetch up to 3 child sitemaps in parallel
      const childSitemaps = indexMatches.slice(0, 3).map(m => m.match(/<loc>(.*?)<\/loc>/)?.[1]).filter(Boolean);
      const childResults = await Promise.all(childSitemaps.map(u => fetchHtml(u, 5000)));
      for (const child of childResults) {
        if (!child) continue;
        const locs = (child.match(/<loc>(.*?)<\/loc>/g) || []).map(m => m.replace(/<\/?loc>/g, ''));
        allUrls.push(...locs.filter(u => new URL(u).hostname === hostname));
      }
    }
    // Also get urls directly in this file
    const directLocs = (xml.match(/<loc>(.*?)<\/loc>/g) || []).map(m => m.replace(/<\/?loc>/g, ''))
      .filter(u => { try { return new URL(u).hostname === hostname; } catch (_) { return false; } });
    allUrls.push(...directLocs);
    if (allUrls.length > 0) {
      return { found: true, total: allUrls.length, urls: allUrls };
    }
  }
  return { found: false, total: 0, urls: [] };
}

// ─── JSON repair helper ───────────────────────────────────────────────────────

function extractAndParseJSON(text) {
  try { return JSON.parse(text.trim()); } catch (_) {}
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON found in response');
  let json = match[0];
  try { return JSON.parse(json); } catch (_) {}

  // Repair truncated JSON
  let braces = 0, brackets = 0, inString = false, escape = false;
  for (const ch of json) {
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') braces++;
    if (ch === '}') braces--;
    if (ch === '[') brackets++;
    if (ch === ']') brackets--;
  }
  if (inString) json += '"';
  while (brackets > 0) { json += ']'; brackets--; }
  while (braces > 0) { json += '}'; braces--; }
  json = json.replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(json);
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    const targetUrl = url.startsWith('http') ? url : `https://${url}`;
    const urlObj = new URL(targetUrl);
    const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;
    const hostname = urlObj.hostname;

    // ── Stage 1: Fetch homepage + robots.txt + sitemap simultaneously ──────
    const [homeHtml, robotsHtml, sitemapData] = await Promise.all([
      fetchHtml(targetUrl, 10000),
      fetchHtml(`${baseUrl}/robots.txt`, 5000),
      getSitemapUrls(baseUrl, hostname),
    ]);

    const robotsTxt = robotsHtml || '';
    const homeParsed = homeHtml ? parsePage(homeHtml, targetUrl) : null;

    // ── Stage 2: Build a prioritised crawl list ────────────────────────────
    // Start with sitemap URLs (best source), fall back to links from homepage
    let candidateUrls = [];

    if (sitemapData.found && sitemapData.urls.length > 0) {
      // Score and sort all sitemap URLs by clinical relevance
      const scored = sitemapData.urls
        .map(u => ({ url: u, score: scoreUrl(u) }))
        .filter(x => x.score >= 0)
        .sort((a, b) => b.score - a.score);

      // Take top 10 clinical pages + ensure homepage is included
      candidateUrls = scored.slice(0, 10).map(x => x.url);
    } else if (homeParsed?.links?.length > 0) {
      // No sitemap — use links found on homepage
      const scored = homeParsed.links
        .map(u => ({ url: u, score: scoreUrl(u) }))
        .filter(x => x.score >= 0)
        .sort((a, b) => b.score - a.score);
      candidateUrls = scored.slice(0, 10).map(x => x.url);
    }

    // Remove the homepage if it's already in the list (we have it)
    candidateUrls = candidateUrls.filter(u => u !== targetUrl);

    // ── Stage 3: Crawl all candidate pages in parallel ────────────────────
    const pageResults = await Promise.allSettled(
      candidateUrls.map(async pageUrl => {
        const html = await fetchHtml(pageUrl, 7000);
        if (!html) return null;
        const parsed = parsePage(html, pageUrl);
        return { url: pageUrl, title: parsed.title, text: parsed.text, structuredData: parsed.structuredData };
      })
    );

    const additionalPages = pageResults
      .filter(r => r.status === 'fulfilled' && r.value)
      .map(r => r.value);

    // ── Stage 4: Aggregate results ─────────────────────────────────────────
    const allStructuredData = [
      ...(homeParsed?.structuredData || []),
      ...additionalPages.flatMap(p => p.structuredData),
    ];

    const pagesAnalysed = [
      { url: targetUrl, title: homeParsed?.title || targetUrl, type: 'Entry page' },
      ...additionalPages.map(p => ({ url: p.url, title: p.title, type: 'Clinical/service page' })),
    ];

    // Build combined content, prioritising clinical pages
    const contentBlocks = [
      homeParsed ? `=== HOMEPAGE: ${targetUrl} ===\nTitle: ${homeParsed.title}\n${homeParsed.text}` : '',
      ...additionalPages.map(p => `=== PAGE: ${p.url} ===\nTitle: ${p.title}\n${p.text}`),
    ].filter(Boolean);

    // Fit within ~7000 chars, distributing space across pages
    const maxPerPage = Math.floor(6500 / Math.max(contentBlocks.length, 1));
    const combinedContent = contentBlocks.map(b => b.substring(0, maxPerPage)).join('\n\n');

    // ── Stage 5: Claude analysis ───────────────────────────────────────────
    const prompt = `You are a digital governance expert analysing an NHS/healthcare website. You have crawled ${pagesAnalysed.length} pages across the site. Your task is to assess how AI web scraping tools would interpret and use this website's content, and identify risks — especially around clinical information.

Domain: ${hostname}
Pages crawled: ${pagesAnalysed.length}
Sitemap found: ${sitemapData.found} (${sitemapData.total} total URLs in sitemap)

Pages analysed:
${pagesAnalysed.map((p, i) => `${i + 1}. [${p.type}] ${p.url}`).join('\n')}

## robots.txt
${robotsTxt ? robotsTxt.substring(0, 1500) : 'NOT FOUND — no robots.txt for this domain'}

## Structured Data (JSON-LD across all pages)
${allStructuredData.length > 0 ? JSON.stringify(allStructuredData, null, 2).substring(0, 1500) : 'None found'}

## Content from ${pagesAnalysed.length} crawled pages:
${combinedContent}

Return ONLY valid JSON (no markdown) in this exact structure. Keep all string values under 200 characters. Keep arrays to max 5 items:

{
  "robotsTxt": {
    "exists": true/false,
    "summary": "brief description of robots.txt rules",
    "aiProtection": "none"/"partial"/"good",
    "allowsAIScraping": true/false,
    "keyDirectives": ["up to 5 key rules"],
    "recommendation": "specific advice under 200 chars"
  },
  "structuredData": {
    "found": true/false,
    "types": ["schema types found"],
    "quality": "none"/"poor"/"basic"/"good"/"excellent",
    "summary": "what structured data exists and what it tells AI",
    "aiImpact": "how AI tools will use this structured data",
    "recommendation": "specific improvements under 200 chars"
  },
  "clinicalInformation": {
    "hasClinicalContent": true/false,
    "contentTypes": ["up to 5 specific types of clinical content found"],
    "accuracy": "assessment of clinical content quality",
    "misrepresentationRisk": "low"/"medium"/"high"/"critical",
    "misrepresentationConcerns": ["up to 5 specific concerns based on actual content found"],
    "outOfContextRisks": ["up to 5 specific risks from decontextualisation"],
    "recommendation": "specific advice under 200 chars"
  },
  "overallRisk": {
    "score": 1-10,
    "level": "low"/"medium"/"high"/"critical",
    "summary": "2-3 sentence overall assessment",
    "topConcerns": ["top 5 specific concerns from actual content found"],
    "immediateActions": ["up to 5 urgent specific actions"]
  },
  "scrapingProfile": {
    "whatAIWouldExtract": ["up to 5 specific data types AI would extract"],
    "howItWouldBeUsed": "how scraped content will appear in AI responses",
    "potentialHarms": ["up to 5 specific harms from AI misuse"]
  }
}`;

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    const analysis = extractAndParseJSON(responseText);

    return res.status(200).json({
      url: targetUrl,
      title: homeParsed?.title || targetUrl,
      robotsTxt: robotsTxt || null,
      structuredData: allStructuredData,
      pagesAnalysed,
      sitemapFound: sitemapData.found,
      sitemapTotal: sitemapData.total,
      analysis,
    });

  } catch (error) {
    console.error('Scrape error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to analyse website'
    });
  }
}
