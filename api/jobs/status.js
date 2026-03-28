// GET /api/jobs/status?id=<jobId>&pages=true&riskFilter=high&clinicalOnly=true

import { getJob, getJobStats, getJobPages } from '../lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id, pages, riskFilter, clinicalOnly } = req.query;
  if (!id) return res.status(400).json({ error: 'Job ID required' });

  try {
    const [job, stats] = await Promise.all([
      getJob(id),
      getJobStats(id),
    ]);

    if (!job) return res.status(404).json({ error: 'Job not found' });

    const response = { job, stats };

    if (pages === 'true') {
      response.pages = await getJobPages(id, {
        riskFilter,
        clinicalOnly: clinicalOnly === 'true',
        limit: 200,
        offset: 0,
      });
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error('Status error:', error);
    return res.status(500).json({ error: error.message });
  }
}
