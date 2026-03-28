// POST /api/jobs/start — starts a new full-site crawl job

import { createJob, updateJob, insertPages } from '../lib/db.js';
import { fetchHtml, getSitemapUrls, parsePage, scoreUrl } from '../lib/crawler.js';

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
    const domain = urlObj.hostname;

    // Create job record immediately so we can return a job ID
    const job = await createJob(targetUrl, domain);

    // Fetch robots.txt and sitemap in parallel
    const [robotsHtml, sitemapData] = await Promise.all([
      fetchHtml(`${baseUrl}/robots.txt`, 5000),
      getSitemapUrls(baseUrl, domain),
    ]);

    let urlsToQueue = [];

    if (sitemapData.found && sitemapData.urls.length > 0) {
      // Use sitemap — score, filter and deduplicate
      const scored = sitemapData.urls
        .filter(u => { try { new URL(u); return true; } catch { return false; } })
        .map(u => ({ url: u, score: scoreUrl(u) }))
        .filter(x => x.score >= 0)
        .sort((a, b) => b.score - a.score);
      urlsToQueue = scored.map(x => x.url);
    } else {
      // Fallback: crawl homepage and collect links
      const homeHtml = await fetchHtml(targetUrl, 10000);
      if (homeHtml) {
        const parsed = parsePage(homeHtml, targetUrl);
        const scored = parsed.links
          .map(u => ({ url: u, score: scoreUrl(u) }))
          .filter(x => x.score >= 0)
          .sort((a, b) => b.score - a.score);
        urlsToQueue = [targetUrl, ...scored.map(x => x.url)];
      } else {
        urlsToQueue = [targetUrl];
      }
    }

    // Always include the entry URL as the first page
    if (!urlsToQueue.includes(targetUrl)) urlsToQueue.unshift(targetUrl);
    urlsToQueue = [...new Set(urlsToQueue)]; // deduplicate

    // Cap at 2000 pages to avoid runaway jobs
    urlsToQueue = urlsToQueue.slice(0, 2000);

    // Insert all pages into queue in batches of 500 (Supabase row limit per request)
    const pageRows = urlsToQueue.map(u => ({ job_id: job.id, url: u, status: 'pending' }));
    for (let i = 0; i < pageRows.length; i += 500) {
      await insertPages(pageRows.slice(i, i + 500));
    }

    // Update job with total count, robots.txt and sitemap metadata
    await updateJob(job.id, {
      status: 'running',
      total_pages: urlsToQueue.length,
      sitemap_found: sitemapData.found,
      sitemap_total: sitemapData.total,
      robots_txt: robotsHtml ? robotsHtml.substring(0, 5000) : null,
    });

    return res.status(200).json({
      jobId: job.id,
      domain,
      totalPages: urlsToQueue.length,
      sitemapFound: sitemapData.found,
      sitemapTotal: sitemapData.total,
      message: `Crawl job started. ${urlsToQueue.length} pages queued.`,
    });
  } catch (error) {
    console.error('Start job error:', error);
    return res.status(500).json({ error: error.message || 'Failed to start crawl job' });
  }
}
