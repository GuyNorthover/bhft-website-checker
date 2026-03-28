// GET /api/jobs/list — list all crawl jobs, most recent first

import { listJobs } from '../lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const jobs = await listJobs();
    return res.status(200).json({ jobs: jobs || [] });
  } catch (error) {
    console.error('List jobs error:', error);
    return res.status(500).json({ error: error.message });
  }
}
