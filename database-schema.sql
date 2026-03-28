-- Healthcare Website AI Risk Checker — Neon PostgreSQL Schema
-- Run this once in the Neon SQL editor (console.neon.tech → your project → SQL Editor)

-- Crawl jobs table
CREATE TABLE IF NOT EXISTS crawl_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  total_pages INTEGER DEFAULT 0,
  crawled_pages INTEGER DEFAULT 0,
  failed_pages INTEGER DEFAULT 0,
  clinical_pages INTEGER DEFAULT 0,
  high_risk_pages INTEGER DEFAULT 0,
  robots_txt TEXT,
  sitemap_found BOOLEAN DEFAULT false,
  sitemap_total INTEGER DEFAULT 0,
  overall_risk_score FLOAT,
  overall_risk_level TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error TEXT
);

-- Pages queue
CREATE TABLE IF NOT EXISTS crawl_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES crawl_jobs(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  title TEXT,
  has_clinical_content BOOLEAN,
  misrepresentation_risk TEXT,
  clinical_content_types TEXT[],
  misrepresentation_concerns TEXT[],
  out_of_context_risks TEXT[],
  recommendation TEXT,
  page_summary TEXT,
  raw_analysis JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  analysed_at TIMESTAMPTZ,
  UNIQUE(job_id, url)
);

CREATE INDEX IF NOT EXISTS idx_pages_job_status ON crawl_pages(job_id, status);
CREATE INDEX IF NOT EXISTS idx_pages_risk ON crawl_pages(job_id, misrepresentation_risk);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON crawl_jobs(status);
