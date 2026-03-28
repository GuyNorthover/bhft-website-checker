// Reusable crawl utilities — fetch, parse, score, sitemap discovery

import * as cheerio from 'cheerio';

// ─── Fetch ────────────────────────────────────────────────────────────────────

export async function fetchHtml(url, timeoutMs = 8000) {
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
  } catch (_) {
    return null;
  }
}

// ─── Page parser ──────────────────────────────────────────────────────────────

export function parsePage(html, url) {
  const $ = cheerio.load(html);
  const title = $('title').text().trim();

  const structuredData = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try { structuredData.push(JSON.parse($(el).html() || '')); } catch (_) {}
  });

  const baseHost = new URL(url).hostname;
  const links = new Set();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    try {
      const abs = href.startsWith('http') ? href : new URL(href, url).href;
      const host = new URL(abs).hostname;
      if (
        host === baseHost &&
        !abs.includes('#') &&
        !abs.match(/\.(pdf|jpg|jpeg|png|gif|css|js|xml|zip|doc|docx|svg|ico|woff|woff2|ttf|eot)$/i)
      ) {
        links.add(abs);
      }
    } catch (_) {}
  });

  // Strip non-content elements before extracting text
  $('script, style, nav, footer, header, .cookie-banner, .skip-link, [aria-hidden="true"], noscript').remove();
  const text = $('body').text().replace(/\s+/g, ' ').trim().substring(0, 3000);

  return { title, structuredData, text, links: [...links] };
}

// ─── URL scoring ──────────────────────────────────────────────────────────────

const CLINICAL_KEYWORDS = [
  'service', 'patient', 'clinic', 'health', 'treatment', 'condition', 'care',
  'mental', 'ward', 'referral', 'appointment', 'emergency', 'medicine', 'drug',
  'therapy', 'support', 'advice', 'symptom', 'diagnosis', 'medication',
  'assessment', 'inpatient', 'outpatient', 'crisis', 'wellbeing', 'recovery',
  'community', 'dementia', 'anxiety', 'depression', 'autism', 'eating-disorder',
  'learning-disabilit', 'child', 'adult', 'older', 'perinatal', 'forensic',
  'rehabilitation', 'palliative', 'oncology', 'cardiology', 'diabetes',
];

const SKIP_PATTERNS = [
  /\/(login|search\?|print|share|cookie|privacy|terms|sitemap\.xml|staff\/|job|career|news|press|media|foi|freedom|contact|about|vacancies|board|governance|annual-report|annual_report)\b/i,
  /\?.*page=/i,
  /\?.*sort=/i,
  /\?.*filter=/i,
];

export function scoreUrl(url) {
  if (SKIP_PATTERNS.some(p => p.test(url))) return -1;
  const lower = url.toLowerCase();
  return CLINICAL_KEYWORDS.reduce((s, kw) => lower.includes(kw) ? s + 1 : s, 0);
}

// ─── Sitemap discovery ────────────────────────────────────────────────────────

export async function getSitemapUrls(baseUrl, hostname) {
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
      // Fetch up to 5 child sitemaps in parallel
      const childSitemaps = indexMatches
        .slice(0, 5)
        .map(m => m.match(/<loc>(.*?)<\/loc>/)?.[1])
        .filter(Boolean);
      const childResults = await Promise.all(childSitemaps.map(u => fetchHtml(u, 6000)));
      for (const child of childResults) {
        if (!child) continue;
        const locs = (child.match(/<loc>(.*?)<\/loc>/g) || [])
          .map(m => m.replace(/<\/?loc>/g, ''))
          .filter(u => { try { return new URL(u).hostname === hostname; } catch { return false; } });
        allUrls.push(...locs);
      }
    }

    // Also get URLs directly in this file
    const directLocs = (xml.match(/<loc>(.*?)<\/loc>/g) || [])
      .map(m => m.replace(/<\/?loc>/g, ''))
      .filter(u => { try { return new URL(u).hostname === hostname; } catch { return false; } });
    allUrls.push(...directLocs);
    allUrls = [...new Set(allUrls)];

    if (allUrls.length > 0) {
      return { found: true, total: allUrls.length, urls: allUrls };
    }
  }

  return { found: false, total: 0, urls: [] };
}
