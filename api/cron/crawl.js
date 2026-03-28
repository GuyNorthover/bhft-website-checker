// Vercel Cron handler — runs every minute
// Picks up pending pages, fetches & analyses them with Claude, writes results to Supabase

import Anthropic from '@anthropic-ai/sdk';
import {
  getAnyPendingPages,
  markPageProcessing,
  updatePage,
  updateJob,
  getJobStats,
} from '../lib/db.js';
import { fetchHtml, parsePage } from '../lib/crawler.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Per-page AI analysis ──────────────────────────────────────────────────────

async function analysePage(url, title, text, structuredData) {
  const sdSummary = structuredData.length > 0
    ? JSON.stringify(structuredData).substring(0, 500)
    : 'none';

  const prompt = `Analyse this NHS/healthcare webpage for clinical content and AI scraping risks. Be concise.

URL: ${url}
Title: ${title}
Content: ${text.substring(0, 2000)}
Structured Data: ${sdSummary}

Return ONLY valid JSON, string values max 150 chars, arrays max 4 items:
{
  "hasClinicalContent": true/false,
  "pageSummary": "one sentence description of what this page is about",
  "contentTypes": ["specific clinical content types found, e.g. medication dosing, mental health crisis line, treatment pathway"],
  "misrepresentationRisk": "low"/"medium"/"high"/"critical",
  "misrepresentationConcerns": ["specific ways AI could misrepresent content on this page"],
  "outOfContextRisks": ["specific risks if this content is used without context"],
  "recommendation": "one specific action to reduce AI misrepresentation risk"
}`;

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

  try {
    // Extract JSON block from response
    const match = responseText.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch (_) {
    return null;
  }
}

// ─── Overall risk calculation ──────────────────────────────────────────────────

function calculateOverallRisk(stats) {
  if (stats.total === 0) return { score: 1, level: 'low' };
  const clinicalRatio = stats.clinical / stats.total;
  const highRiskRatio = stats.highRisk / Math.max(stats.clinical, 1);
  const score = Math.min(10, Math.round(1 + (clinicalRatio * 4) + (highRiskRatio * 5)));
  const level = score <= 3 ? 'low' : score <= 5 ? 'medium' : score <= 7 ? 'high' : 'critical';
  return { score, level };
}

// ─── Main cron handler ─────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // Verify Vercel cron secret when set
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const startTime = Date.now();
  const BATCH_SIZE = 5;
  const MAX_RUN_MS = 50000; // Stop 10s before Vercel's 60s limit

  let totalProcessed = 0;
  let totalErrors = 0;

  try {
    while (Date.now() - startTime < MAX_RUN_MS) {
      // Grab a batch of pending pages from any running job
      const pendingPages = await getAnyPendingPages(BATCH_SIZE);
      if (!pendingPages || pendingPages.length === 0) break;

      // Mark all as processing first to prevent double-processing across cron invocations
      await Promise.all(pendingPages.map(p => markPageProcessing(p.id)));

      // Process the batch in parallel
      const results = await Promise.allSettled(
        pendingPages.map(async (page) => {
          try {
            const html = await fetchHtml(page.url, 8000);

            if (!html) {
              await updatePage(page.id, {
                status: 'failed',
                error: 'Could not fetch page — HTTP error or timeout',
                analysed_at: new Date().toISOString(),
              });
              return { success: false };
            }

            const parsed = parsePage(html, page.url);
            const analysis = await analysePage(page.url, parsed.title, parsed.text, parsed.structuredData);

            if (!analysis) {
              await updatePage(page.id, {
                status: 'failed',
                title: parsed.title || null,
                error: 'AI analysis failed to return valid JSON',
                analysed_at: new Date().toISOString(),
              });
              return { success: false };
            }

            await updatePage(page.id, {
              status: 'complete',
              title: parsed.title || null,
              has_clinical_content: analysis.hasClinicalContent === true,
              misrepresentation_risk: analysis.misrepresentationRisk || 'low',
              clinical_content_types: Array.isArray(analysis.contentTypes) ? analysis.contentTypes : [],
              misrepresentation_concerns: Array.isArray(analysis.misrepresentationConcerns) ? analysis.misrepresentationConcerns : [],
              out_of_context_risks: Array.isArray(analysis.outOfContextRisks) ? analysis.outOfContextRisks : [],
              recommendation: analysis.recommendation || null,
              page_summary: analysis.pageSummary || null,
              raw_analysis: analysis,
              analysed_at: new Date().toISOString(),
            });

            return {
              success: true,
              hasClinical: analysis.hasClinicalContent,
              risk: analysis.misrepresentationRisk,
            };
          } catch (e) {
            console.error(`Page error for ${page.url}:`, e.message);
            await updatePage(page.id, {
              status: 'failed',
              error: (e.message || 'Unknown error').substring(0, 200),
              analysed_at: new Date().toISOString(),
            });
            return { success: false };
          }
        })
      );

      totalProcessed += pendingPages.length;
      totalErrors += results.filter(r => r.status === 'fulfilled' && !r.value?.success).length;

      // Update job stats for every unique job in this batch
      const jobIds = [...new Set(pendingPages.map(p => p.job_id))];
      for (const jobId of jobIds) {
        try {
          const stats = await getJobStats(jobId);
          const isComplete = stats.pending === 0 && stats.processing === 0;
          const riskResult = isComplete ? calculateOverallRisk(stats) : null;

          await updateJob(jobId, {
            crawled_pages: stats.complete,
            failed_pages: stats.failed,
            clinical_pages: stats.clinical,
            high_risk_pages: stats.highRisk,
            ...(isComplete ? {
              status: 'complete',
              completed_at: new Date().toISOString(),
              overall_risk_score: riskResult.score,
              overall_risk_level: riskResult.level,
            } : {}),
          });
        } catch (e) {
          console.error(`Failed to update job stats for ${jobId}:`, e.message);
        }
      }

      // If we got fewer pages than the batch size, the queue is probably empty
      if (pendingPages.length < BATCH_SIZE) break;
    }

    return res.status(200).json({
      processed: totalProcessed,
      errors: totalErrors,
      durationMs: Date.now() - startTime,
    });
  } catch (error) {
    console.error('Cron top-level error:', error);
    return res.status(500).json({ error: error.message });
  }
}
