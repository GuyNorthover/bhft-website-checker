import { neon } from '@neondatabase/serverless';

function getDb() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL environment variable is not set');
  return neon(process.env.DATABASE_URL);
}

// Build a dynamic UPDATE query safely (column names come from our code, not user input)
async function dynamicUpdate(table, id, data) {
  const db = getDb();
  const keys = Object.keys(data);
  if (keys.length === 0) return;
  const values = Object.values(data);
  const setClauses = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  await db(`UPDATE ${table} SET ${setClauses} WHERE id = $1`, [id, ...values]);
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export async function createJob(url, domain) {
  const db = getDb();
  const rows = await db`
    INSERT INTO crawl_jobs (url, domain, status)
    VALUES (${url}, ${domain}, 'pending')
    RETURNING *
  `;
  return rows[0];
}

export async function updateJob(id, data) {
  return dynamicUpdate('crawl_jobs', id, data);
}

export async function getJob(id) {
  const db = getDb();
  const rows = await db`SELECT * FROM crawl_jobs WHERE id = ${id}`;
  return rows[0] || null;
}

export async function listJobs() {
  const db = getDb();
  return db`SELECT * FROM crawl_jobs ORDER BY started_at DESC LIMIT 20`;
}

// ─── Pages ────────────────────────────────────────────────────────────────────

export async function insertPages(pages) {
  if (!pages || pages.length === 0) return;
  const db = getDb();
  // Bulk insert using VALUES rows — much faster than looping
  const CHUNK = 100; // Neon handles ~100 rows per statement comfortably
  for (let i = 0; i < pages.length; i += CHUNK) {
    const chunk = pages.slice(i, i + CHUNK);
    // Build parameterised VALUES list
    const placeholders = chunk.map((_, j) => `($${j * 2 + 1}, $${j * 2 + 2}, 'pending')`).join(', ');
    const params = chunk.flatMap(p => [p.job_id, p.url]);
    await db(
      `INSERT INTO crawl_pages (job_id, url, status)
       VALUES ${placeholders}
       ON CONFLICT (job_id, url) DO NOTHING`,
      params
    );
  }
}

export async function getAnyPendingPages(limit = 5) {
  const db = getDb();
  return db`
    SELECT cp.*
    FROM crawl_pages cp
    JOIN crawl_jobs cj ON cj.id = cp.job_id
    WHERE cp.status = 'pending'
      AND cj.status = 'running'
    ORDER BY cp.created_at ASC
    LIMIT ${limit}
  `;
}

export async function markPageProcessing(id) {
  const db = getDb();
  await db`UPDATE crawl_pages SET status = 'processing' WHERE id = ${id}`;
}

export async function updatePage(id, data) {
  return dynamicUpdate('crawl_pages', id, data);
}

export async function getJobStats(jobId) {
  const db = getDb();
  const rows = await db`
    SELECT
      COUNT(*)                                                          AS total,
      COUNT(*) FILTER (WHERE status = 'pending')                       AS pending,
      COUNT(*) FILTER (WHERE status = 'processing')                    AS processing,
      COUNT(*) FILTER (WHERE status = 'complete')                      AS complete,
      COUNT(*) FILTER (WHERE status IN ('failed','skipped'))           AS failed,
      COUNT(*) FILTER (WHERE has_clinical_content = true)              AS clinical,
      COUNT(*) FILTER (WHERE misrepresentation_risk IN ('high','critical')) AS high_risk
    FROM crawl_pages
    WHERE job_id = ${jobId}
  `;
  const r = rows[0];
  return {
    total:      Number(r.total),
    pending:    Number(r.pending),
    processing: Number(r.processing),
    complete:   Number(r.complete),
    failed:     Number(r.failed),
    clinical:   Number(r.clinical),
    highRisk:   Number(r.high_risk),
  };
}

export async function getJobPages(jobId, options = {}) {
  const db = getDb();
  const { riskFilter, clinicalOnly, limit = 500, offset = 0 } = options;

  const riskOrder = `CASE misrepresentation_risk
    WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END`;

  if (riskFilter && clinicalOnly) {
    return db(`
      SELECT * FROM crawl_pages
      WHERE job_id = $1 AND status = 'complete'
        AND misrepresentation_risk = $2 AND has_clinical_content = true
      ORDER BY ${riskOrder}, url
      LIMIT $3 OFFSET $4`,
      [jobId, riskFilter, limit, offset]
    );
  }
  if (riskFilter) {
    return db(`
      SELECT * FROM crawl_pages
      WHERE job_id = $1 AND status = 'complete' AND misrepresentation_risk = $2
      ORDER BY ${riskOrder}, url LIMIT $3 OFFSET $4`,
      [jobId, riskFilter, limit, offset]
    );
  }
  if (clinicalOnly) {
    return db(`
      SELECT * FROM crawl_pages
      WHERE job_id = $1 AND status = 'complete' AND has_clinical_content = true
      ORDER BY ${riskOrder}, url LIMIT $2 OFFSET $3`,
      [jobId, limit, offset]
    );
  }
  return db(`
    SELECT * FROM crawl_pages
    WHERE job_id = $1 AND status = 'complete'
    ORDER BY ${riskOrder}, url LIMIT $2 OFFSET $3`,
    [jobId, limit, offset]
  );
}
