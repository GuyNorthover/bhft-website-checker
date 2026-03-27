import Anthropic from '@anthropic-ai/sdk';
import * as cheerio from 'cheerio';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body || {};

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    // Normalise URL
    const targetUrl = url.startsWith('http') ? url : `https://${url}`;
    const urlObj = new URL(targetUrl);
    const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;

    // 1. Fetch the main page
    let pageHtml = '';
    let pageError = null;
    try {
      const pageRes = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; BHFTWebChecker/1.0; +https://bhft.nhs.uk)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(10000),
      });
      pageHtml = await pageRes.text();
    } catch (e) {
      pageError = e.message;
    }

    // 2. Fetch robots.txt
    let robotsTxt = '';
    let robotsError = null;
    try {
      const robotsRes = await fetch(`${baseUrl}/robots.txt`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BHFTWebChecker/1.0)' },
        signal: AbortSignal.timeout(5000),
      });
      if (robotsRes.ok) {
        robotsTxt = await robotsRes.text();
      } else {
        robotsError = `HTTP ${robotsRes.status}`;
      }
    } catch (e) {
      robotsError = e.message;
    }

    // 3. Parse HTML with cheerio
    let structuredData = [];
    let metaTags = {};
    let pageText = '';
    let title = '';

    if (pageHtml) {
      const $ = cheerio.load(pageHtml);

      title = $('title').text().trim();

      $('meta').each((_, el) => {
        const name = $(el).attr('name') || $(el).attr('property') || $(el).attr('http-equiv');
        const content = $(el).attr('content');
        if (name && content) {
          metaTags[name] = content;
        }
      });

      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const json = JSON.parse($(el).html() || '');
          structuredData.push(json);
        } catch (e) {
          // Invalid JSON, skip
        }
      });

      $('script, style, nav, footer').remove();
      pageText = $('body').text().replace(/\s+/g, ' ').trim().substring(0, 5000);
    }

    // 4. Claude analysis
    const prompt = `You are a digital governance expert analysing a website for an NHS trust. Your task is to assess how AI web scraping tools would interpret and use this website's content, and identify risks — especially around clinical information.

Website URL: ${targetUrl}
Page Title: ${title || 'Not found'}
${pageError ? `Page fetch error: ${pageError}` : ''}

## robots.txt (from ${baseUrl}/robots.txt)
${robotsTxt ? robotsTxt.substring(0, 2000) : `Not found or error: ${robotsError || 'No robots.txt'}`}

## Meta Tags
${JSON.stringify(metaTags, null, 2).substring(0, 800)}

## Structured Data (JSON-LD schemas found on page)
${structuredData.length > 0 ? JSON.stringify(structuredData, null, 2).substring(0, 2000) : 'None found'}

## Page Content Sample
${pageText ? pageText.substring(0, 4000) : 'Could not extract content'}

Analyse this website and return ONLY valid JSON (no markdown, no explanation) in exactly this structure:

{
  "robotsTxt": {
    "exists": true or false,
    "summary": "plain English description of what robots.txt says",
    "aiProtection": "none" or "partial" or "good",
    "allowsAIScraping": true or false,
    "keyDirectives": ["list of important rules found"],
    "recommendation": "specific advice on what to add or change"
  },
  "structuredData": {
    "found": true or false,
    "types": ["schema types found, e.g. Organization, MedicalWebPage, BreadcrumbList"],
    "quality": "none" or "poor" or "basic" or "good" or "excellent",
    "summary": "what structured data exists and what it communicates to AI scrapers",
    "aiImpact": "how this structured data shapes what AI tools learn and say about this site",
    "recommendation": "specific improvements to make"
  },
  "clinicalInformation": {
    "hasClinicalContent": true or false,
    "contentTypes": ["types of clinical content found, e.g. medication info, symptoms, treatment pathways"],
    "accuracy": "assessment of how clear and appropriate the clinical content appears",
    "misrepresentationRisk": "low" or "medium" or "high" or "critical",
    "misrepresentationConcerns": ["specific ways AI could misrepresent or misuse this content"],
    "outOfContextRisks": ["risks if content is extracted and used without context"],
    "recommendation": "what the website should do to protect its clinical content"
  },
  "overallRisk": {
    "score": number from 1 to 10 where 10 is highest risk,
    "level": "low" or "medium" or "high" or "critical",
    "summary": "2-3 sentence overall assessment",
    "topConcerns": ["top 3 to 5 specific concerns"],
    "immediateActions": ["urgent actions the website owner should take"]
  },
  "scrapingProfile": {
    "whatAIWouldExtract": ["specific types of data an AI scraper would pull from this site"],
    "howItWouldBeUsed": "how this scraped content might appear in AI chatbot responses or training data",
    "potentialHarms": ["specific harms that could result from AI misuse of this content"]
  }
}`;

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

    // Extract JSON - try direct parse first, then regex
    let analysis;
    try {
      analysis = JSON.parse(responseText);
    } catch {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse analysis from Claude response');
      }
    }

    return res.status(200).json({
      url: targetUrl,
      title: title || targetUrl,
      robotsTxt: robotsTxt || null,
      structuredData,
      analysis,
    });

  } catch (error) {
    console.error('Scrape error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to analyse website'
    });
  }
}
