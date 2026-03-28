import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, ShadingType, convertInchesToTwip,
  VerticalAlign,
} from 'docx'

// ─── Types ────────────────────────────────────────────────────────────────────

type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
type JobStatus = 'pending' | 'running' | 'complete' | 'failed'

interface CrawlJob {
  id: string
  url: string
  domain: string
  status: JobStatus
  total_pages: number
  crawled_pages: number
  failed_pages: number
  clinical_pages: number
  high_risk_pages: number
  sitemap_found: boolean
  sitemap_total: number
  overall_risk_score: number | null
  overall_risk_level: string | null
  started_at: string
  completed_at: string | null
  error: string | null
}

interface JobStats {
  total: number
  pending: number
  processing: number
  complete: number
  failed: number
  clinical: number
  highRisk: number
}

interface CrawlPage {
  id: string
  job_id: string
  url: string
  status: string
  title: string | null
  has_clinical_content: boolean | null
  misrepresentation_risk: RiskLevel | null
  clinical_content_types: string[] | null
  misrepresentation_concerns: string[] | null
  out_of_context_risks: string[] | null
  recommendation: string | null
  page_summary: string | null
  analysed_at: string | null
  error: string | null
}

type PageFilter = 'all' | 'clinical' | 'high' | 'critical'

// ─── Docx report generator ────────────────────────────────────────────────────

function riskHex(level: string | null) {
  switch (level) {
    case 'low':      return 'D1FAE5'
    case 'medium':   return 'FEF3C7'
    case 'high':     return 'FFEDD5'
    case 'critical': return 'FEE2E2'
    default:         return 'F3F4F6'
  }
}

function riskTextHex(level: string | null) {
  switch (level) {
    case 'low':      return '065F46'
    case 'medium':   return '92400E'
    case 'high':     return '9A3412'
    case 'critical': return '7F1D1D'
    default:         return '374151'
  }
}

function para(text: string, opts: { bold?: boolean; size?: number; color?: string; italic?: boolean } = {}) {
  return new Paragraph({
    children: [new TextRun({
      text,
      bold: opts.bold,
      size: opts.size ?? 22,
      color: opts.color,
      italics: opts.italic,
    })],
    spacing: { after: 80 },
  })
}

function heading1(text: string) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    border: { bottom: { color: '005EB8', size: 6, style: BorderStyle.SINGLE, space: 4 } },
  })
}

function heading2(text: string) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 120 },
  })
}

function bullet(text: string, color?: string) {
  return new Paragraph({
    children: [new TextRun({ text, size: 20, color: color ?? '374151' })],
    bullet: { level: 0 },
    spacing: { after: 60 },
  })
}

function riskTableRow(url: string, title: string | null, risk: string | null, clinical: boolean | null, summary: string | null) {
  const bg = riskHex(risk)
  const textColor = riskTextHex(risk)
  const cell = (text: string, shade?: string) => new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, size: 18 })] })],
    shading: shade ? { type: ShadingType.SOLID, color: shade, fill: shade } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
  })
  const riskCell = new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: (risk ?? 'n/a').toUpperCase(), size: 18, bold: true, color: textColor })] })],
    shading: { type: ShadingType.SOLID, color: bg, fill: bg },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
  })
  return new TableRow({
    children: [
      cell(title || 'Untitled'),
      cell(url.length > 80 ? url.substring(0, 77) + '...' : url),
      riskCell,
      cell(clinical ? 'Yes' : 'No'),
      cell(summary || ''),
    ],
  })
}

async function generateFullReport(job: CrawlJob, stats: JobStats, pages: CrawlPage[]) {
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  const clinicalPages = pages.filter(p => p.has_clinical_content)
  const highRiskPages = pages.filter(p => p.misrepresentation_risk === 'high' || p.misrepresentation_risk === 'critical')
  const criticalPages = pages.filter(p => p.misrepresentation_risk === 'critical')

  // ── Cover stats table ───────────────────────────────────────────────────────
  function statRow(label: string, value: string | number) {
    return new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 20 })] })],
          shading: { type: ShadingType.SOLID, color: 'F8FAFC', fill: 'F8FAFC' },
          margins: { top: 60, bottom: 60, left: 120, right: 120 },
          width: { size: 40, type: WidthType.PERCENTAGE },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: String(value), size: 20 })] })],
          margins: { top: 60, bottom: 60, left: 120, right: 120 },
          width: { size: 60, type: WidthType.PERCENTAGE },
        }),
      ],
    })
  }

  // ── Page results table header ───────────────────────────────────────────────
  function tableHeaderRow() {
    const hCell = (text: string) => new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 18 })] })],
      shading: { type: ShadingType.SOLID, color: '005EB8', fill: '005EB8' },
      margins: { top: 80, bottom: 80, left: 80, right: 80 },
    })
    return new TableRow({
      children: [hCell('Page Title'), hCell('URL'), hCell('Risk'), hCell('Clinical?'), hCell('Summary')],
      tableHeader: true,
    })
  }

  const riskLevelBg = (level: string | null) => {
    switch (level) {
      case 'low': return 'D1FAE5'
      case 'medium': return 'FEF3C7'
      case 'high': return 'FFEDD5'
      case 'critical': return 'FEE2E2'
      default: return 'F3F4F6'
    }
  }

  const coverBg = riskLevelBg(job.overall_risk_level)

  const doc = new Document({
    numbering: {
      config: [{
        reference: 'bullet-list',
        levels: [{ level: 0, format: 'bullet', text: '\u2022', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: convertInchesToTwip(0.25), hanging: convertInchesToTwip(0.25) } } } }],
      }],
    },
    sections: [{
      properties: {},
      children: [
        // ── Cover ─────────────────────────────────────────────────────────────
        new Paragraph({
          children: [new TextRun({ text: 'NHS HEALTHCARE WEBSITE AI RISK CHECKER', bold: true, size: 28, color: '005EB8' })],
          spacing: { before: 0, after: 200 },
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Full Site Crawl & Clinical Analysis Report', bold: true, size: 44 })],
          spacing: { before: 0, after: 120 },
        }),
        para(`Domain: ${job.domain}`, { bold: true, size: 24 }),
        para(`Analysis date: ${date}`, { color: '6B7280' }),
        para(`Pages crawled: ${stats.complete} of ${stats.total}`, { color: '6B7280' }),
        new Paragraph({ text: '', spacing: { after: 200 } }),

        // Risk score banner
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({ text: `Overall Risk Score: ${job.overall_risk_score ?? 'N/A'}/10  `, bold: true, size: 32 }),
                        new TextRun({ text: (job.overall_risk_level ?? 'UNKNOWN').toUpperCase() + ' RISK', bold: true, size: 32, color: riskTextHex(job.overall_risk_level) }),
                      ],
                      alignment: AlignmentType.CENTER,
                    }),
                  ],
                  shading: { type: ShadingType.SOLID, color: coverBg, fill: coverBg },
                  margins: { top: 160, bottom: 160, left: 200, right: 200 },
                }),
              ],
            }),
          ],
        }),

        new Paragraph({ text: '', spacing: { after: 200 } }),

        // ── Job stats table ────────────────────────────────────────────────────
        heading1('Crawl Summary'),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            statRow('Domain', job.domain),
            statRow('Entry URL', job.url),
            statRow('Job Status', job.status.toUpperCase()),
            statRow('Sitemap Found', job.sitemap_found ? `Yes (${job.sitemap_total} total URLs)` : 'No'),
            statRow('Total Pages Queued', stats.total),
            statRow('Pages Analysed', stats.complete),
            statRow('Pages Failed', stats.failed),
            statRow('Clinical Pages Found', stats.clinical),
            statRow('High / Critical Risk Pages', stats.highRisk),
            statRow('Started', new Date(job.started_at).toLocaleString('en-GB')),
            statRow('Completed', job.completed_at ? new Date(job.completed_at).toLocaleString('en-GB') : 'In progress'),
          ],
        }),

        new Paragraph({ text: '', spacing: { after: 200 } }),

        // ── Critical pages ─────────────────────────────────────────────────────
        heading1('Critical Risk Pages'),
        ...(criticalPages.length === 0
          ? [para('No critical-risk pages identified.', { italic: true, color: '6B7280' })]
          : [
              para(`${criticalPages.length} page(s) with critical misrepresentation risk require immediate attention.`, { color: '7F1D1D' }),
              new Paragraph({ text: '', spacing: { after: 100 } }),
              ...criticalPages.flatMap(p => [
                new Paragraph({
                  children: [new TextRun({ text: p.title || 'Untitled Page', bold: true, size: 22 })],
                  spacing: { before: 200, after: 60 },
                }),
                para(p.url, { color: '1D4ED8', size: 18 }),
                ...(p.page_summary ? [para(p.page_summary, { italic: true, color: '4B5563' })] : []),
                ...(p.misrepresentation_concerns?.length
                  ? [heading2('Misrepresentation Concerns'), ...p.misrepresentation_concerns.map(c => bullet(c, '7F1D1D'))]
                  : []),
                ...(p.out_of_context_risks?.length
                  ? [heading2('Out-of-Context Risks'), ...p.out_of_context_risks.map(r => bullet(r, '9A3412'))]
                  : []),
                ...(p.recommendation ? [para(`Recommendation: ${p.recommendation}`, { bold: true, color: '005EB8' })] : []),
              ]),
            ]),

        new Paragraph({ text: '', spacing: { after: 200 } }),

        // ── High risk pages ────────────────────────────────────────────────────
        heading1('High Risk Pages'),
        ...(highRiskPages.filter(p => p.misrepresentation_risk === 'high').length === 0
          ? [para('No high-risk pages identified.', { italic: true, color: '6B7280' })]
          : highRiskPages
              .filter(p => p.misrepresentation_risk === 'high')
              .flatMap(p => [
                new Paragraph({
                  children: [new TextRun({ text: p.title || 'Untitled Page', bold: true, size: 22 })],
                  spacing: { before: 200, after: 60 },
                }),
                para(p.url, { color: '1D4ED8', size: 18 }),
                ...(p.page_summary ? [para(p.page_summary, { italic: true, color: '4B5563' })] : []),
                ...(p.recommendation ? [para(`Recommendation: ${p.recommendation}`, { bold: true, color: '005EB8' })] : []),
              ])),

        new Paragraph({ text: '', spacing: { after: 200 } }),

        // ── Clinical pages overview table ──────────────────────────────────────
        heading1(`Clinical Pages Overview (${clinicalPages.length} pages)`),
        ...(clinicalPages.length === 0
          ? [para('No clinical content pages identified.', { italic: true, color: '6B7280' })]
          : [
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                columnWidths: [2000, 3000, 900, 800, 2300],
                layout: 'fixed' as any,
                rows: [
                  tableHeaderRow(),
                  ...clinicalPages.slice(0, 100).map(p =>
                    riskTableRow(p.url, p.title, p.misrepresentation_risk, p.has_clinical_content, p.page_summary)
                  ),
                ],
              }),
              ...(clinicalPages.length > 100
                ? [para(`... and ${clinicalPages.length - 100} more clinical pages. Filter by risk in the tool to view all.`, { italic: true, color: '6B7280' })]
                : []),
            ]),

        new Paragraph({ text: '', spacing: { after: 200 } }),

        // ── All pages table ────────────────────────────────────────────────────
        heading1(`All Analysed Pages (${pages.length} pages)`),
        ...(pages.length === 0
          ? [para('No pages have been analysed yet.', { italic: true, color: '6B7280' })]
          : [
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                columnWidths: [2000, 3000, 900, 800, 2300],
                layout: 'fixed' as any,
                rows: [
                  tableHeaderRow(),
                  ...pages.slice(0, 200).map(p =>
                    riskTableRow(p.url, p.title, p.misrepresentation_risk, p.has_clinical_content, p.page_summary)
                  ),
                ],
              }),
              ...(pages.length > 200
                ? [para(`... and ${pages.length - 200} additional pages not shown. Download after job completion for full list.`, { italic: true, color: '6B7280' })]
                : []),
            ]),

        // ── Footer note ────────────────────────────────────────────────────────
        new Paragraph({ text: '', spacing: { after: 400 } }),
        new Paragraph({
          children: [new TextRun({ text: 'Generated by NHS Healthcare Website AI Risk Checker · Powered by Claude AI', size: 18, color: '9CA3AF', italics: true })],
          alignment: AlignmentType.CENTER,
          border: { top: { color: 'E5E7EB', size: 4, style: BorderStyle.SINGLE, space: 4 } },
          spacing: { before: 200 },
        }),
      ],
    }],
  })

  const blob = await Packer.toBlob(doc)
  const safeFilename = job.domain.replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').slice(0, 50)
  const filename = `full-site-analysis-${safeFilename}-${new Date().toISOString().slice(0, 10)}.docx`
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(blobUrl)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function riskColors(level: RiskLevel | null | undefined) {
  switch (level) {
    case 'low':      return { text: 'text-emerald-400', bg: 'bg-emerald-900/30', border: 'border-emerald-700', dot: 'bg-emerald-400' }
    case 'medium':   return { text: 'text-yellow-400',  bg: 'bg-yellow-900/30',  border: 'border-yellow-700',  dot: 'bg-yellow-400' }
    case 'high':     return { text: 'text-orange-400',  bg: 'bg-orange-900/30',  border: 'border-orange-700',  dot: 'bg-orange-400' }
    case 'critical': return { text: 'text-red-400',     bg: 'bg-red-900/30',     border: 'border-red-700',     dot: 'bg-red-400' }
    default:         return { text: 'text-gray-400',    bg: 'bg-gray-900/30',    border: 'border-gray-700',    dot: 'bg-gray-400' }
  }
}

function riskScoreColor(score: number | null) {
  if (!score) return 'text-gray-400'
  if (score <= 3) return 'text-emerald-400'
  if (score <= 5) return 'text-yellow-400'
  if (score <= 7) return 'text-orange-400'
  return 'text-red-400'
}

function RiskBadge({ level, label }: { level: RiskLevel | string | null; label?: string }) {
  const c = riskColors(level as RiskLevel)
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide border ${c.text} ${c.bg} ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
      {label ?? level ?? 'n/a'}
    </span>
  )
}

function Spinner({ size = 'h-5 w-5' }: { size?: string }) {
  return (
    <svg className={`animate-spin ${size}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  )
}

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-3xl font-black leading-none ${accent ?? 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
    </div>
  )
}

function ProgressBar({ value, total, label, color = 'bg-blue-500' }: { value: number; total: number; label: string; color?: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-gray-400">{label}</span>
        <span className="text-xs font-semibold text-white">{value} / {total} ({pct}%)</span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ─── Past jobs list ────────────────────────────────────────────────────────────

function PastJobsList({ onSelect }: { onSelect: (jobId: string) => void }) {
  const [jobs, setJobs] = useState<CrawlJob[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/jobs/list')
      .then(r => r.json())
      .then(data => setJobs(data.jobs || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center gap-2 text-gray-500 text-sm py-4">
      <Spinner size="h-4 w-4" /> Loading previous jobs...
    </div>
  )
  if (jobs.length === 0) return null

  return (
    <div className="mt-8">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Previous Crawl Jobs</p>
      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {jobs.map(job => {
          const c = riskColors(job.overall_risk_level as RiskLevel)
          return (
            <button
              key={job.id}
              onClick={() => onSelect(job.id)}
              className="w-full text-left rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all px-4 py-3 flex items-center justify-between gap-4"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white truncate">{job.domain}</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  {new Date(job.started_at).toLocaleDateString('en-GB')} · {job.crawled_pages} pages · {job.clinical_pages} clinical
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {job.overall_risk_level && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${c.text} ${c.bg} ${c.border}`}>
                    {job.overall_risk_score}/10
                  </span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full border ${
                  job.status === 'complete' ? 'text-emerald-400 bg-emerald-900/30 border-emerald-700' :
                  job.status === 'running' ? 'text-blue-400 bg-blue-900/30 border-blue-700' :
                  job.status === 'failed' ? 'text-red-400 bg-red-900/30 border-red-700' :
                  'text-gray-400 bg-gray-900/30 border-gray-700'
                }`}>{job.status}</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Page result row ───────────────────────────────────────────────────────────

function PageRow({ page }: { page: CrawlPage }) {
  const [expanded, setExpanded] = useState(false)
  const risk = page.misrepresentation_risk
  const c = riskColors(risk)

  return (
    <div className={`rounded-lg border transition-all ${expanded ? 'border-white/20 bg-white/[0.07]' : 'border-white/10 bg-white/5 hover:bg-white/[0.07] hover:border-white/15'}`}>
      <button
        className="w-full text-left px-4 py-3 flex items-start gap-3"
        onClick={() => setExpanded(v => !v)}
      >
        {/* Risk dot */}
        <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${c.dot}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{page.title || 'Untitled page'}</p>
          <p className="text-xs text-gray-600 font-mono truncate mt-0.5">{page.url}</p>
          {page.page_summary && !expanded && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-1">{page.page_summary}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {page.has_clinical_content && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-900/40 text-indigo-300 border border-indigo-700/50">clinical</span>
          )}
          {risk && <RiskBadge level={risk} />}
          <svg className={`w-4 h-4 text-gray-600 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-white/10 space-y-3">
          <a href={page.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 font-mono break-all">{page.url}</a>

          {page.page_summary && (
            <p className="text-sm text-gray-300 leading-relaxed">{page.page_summary}</p>
          )}

          {page.clinical_content_types && page.clinical_content_types.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Clinical Content Types</p>
              <div className="flex flex-wrap gap-1.5">
                {page.clinical_content_types.map((t, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-gray-300 border border-white/10">{t}</span>
                ))}
              </div>
            </div>
          )}

          {page.misrepresentation_concerns && page.misrepresentation_concerns.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Misrepresentation Concerns</p>
              <ul className="space-y-1">
                {page.misrepresentation_concerns.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="text-orange-400 flex-shrink-0">⚠</span>{c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {page.out_of_context_risks && page.out_of_context_risks.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Out-of-Context Risks</p>
              <ul className="space-y-1">
                {page.out_of_context_risks.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0 mt-1.5" />{r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {page.recommendation && (
            <div className="p-3 rounded-lg border border-blue-800 bg-blue-900/20">
              <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-1">Recommendation</p>
              <p className="text-sm text-blue-200">{page.recommendation}</p>
            </div>
          )}

          {page.error && (
            <div className="p-3 rounded-lg border border-red-800 bg-red-900/20">
              <p className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-1">Error</p>
              <p className="text-sm text-red-300 font-mono">{page.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Active job view ───────────────────────────────────────────────────────────

function ActiveJob({ jobId, onReset }: { jobId: string; onReset: () => void }) {
  const [job, setJob] = useState<CrawlJob | null>(null)
  const [stats, setStats] = useState<JobStats | null>(null)
  const [pages, setPages] = useState<CrawlPage[]>([])
  const [filter, setFilter] = useState<PageFilter>('all')
  const [loadingPages, setLoadingPages] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchStatus = useCallback(async (loadPagesNow = false) => {
    try {
      const shouldLoadPages = loadPagesNow || pages.length > 0
      const url = `/api/jobs/status?id=${jobId}${shouldLoadPages ? '&pages=true' : ''}`
      const res = await fetch(url)
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || 'Failed to fetch status')
        return
      }
      const data = await res.json()
      setJob(data.job)
      setStats(data.stats)
      if (data.pages) setPages(data.pages)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Network error')
    }
  }, [jobId, pages.length])

  useEffect(() => {
    fetchStatus(false)
    pollingRef.current = setInterval(() => {
      fetchStatus(false)
    }, 5000)
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [jobId])

  // Stop polling when job is terminal
  useEffect(() => {
    if (job?.status === 'complete' || job?.status === 'failed') {
      if (pollingRef.current) clearInterval(pollingRef.current)
      // Load pages when complete
      fetchStatus(true)
    }
  }, [job?.status])

  async function loadFilteredPages(f: PageFilter) {
    setFilter(f)
    setLoadingPages(true)
    try {
      let url = `/api/jobs/status?id=${jobId}&pages=true`
      if (f === 'clinical') url += '&clinicalOnly=true'
      if (f === 'high') url += '&riskFilter=high'
      if (f === 'critical') url += '&riskFilter=critical'
      const res = await fetch(url)
      const data = await res.json()
      if (data.pages) setPages(data.pages)
    } catch (e: unknown) {
      console.error(e)
    } finally {
      setLoadingPages(false)
    }
  }

  async function handleDownload() {
    if (!job || !stats) return
    setDownloading(true)
    try {
      // Load all pages for the report
      let allPages = pages
      if (allPages.length === 0) {
        const res = await fetch(`/api/jobs/status?id=${jobId}&pages=true`)
        const data = await res.json()
        allPages = data.pages || []
      }
      await generateFullReport(job, stats, allPages)
    } catch (e) {
      console.error('Download failed', e)
    } finally {
      setDownloading(false)
    }
  }

  if (!job || !stats) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <Spinner size="h-8 w-8" />
        <p className="text-gray-500 text-sm">Loading job status...</p>
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>
    )
  }

  const isRunning = job.status === 'running' || job.status === 'pending'
  const isComplete = job.status === 'complete'
  const isFailed = job.status === 'failed'

  const analysedPct = stats.total > 0 ? Math.round(((stats.complete + stats.failed) / stats.total) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {isRunning && <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />}
            {isComplete && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
            {isFailed && <span className="w-2 h-2 rounded-full bg-red-400" />}
            <span className={`text-xs font-semibold uppercase tracking-widest ${isRunning ? 'text-blue-400' : isComplete ? 'text-emerald-400' : 'text-red-400'}`}>
              {job.status}
            </span>
          </div>
          <h3 className="text-xl font-bold text-white">{job.domain}</h3>
          <a href={job.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-400 hover:text-blue-300 font-mono">{job.url}</a>
        </div>
        <div className="flex items-center gap-3">
          {isComplete && (
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-2 bg-white text-black font-bold text-sm px-5 py-2.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              {downloading ? <><Spinner size="h-4 w-4" />Generating...</> : (
                <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>Download Report</>
              )}
            </button>
          )}
          <button
            onClick={onReset}
            className="text-sm text-gray-500 hover:text-gray-300 border border-white/10 hover:border-white/20 rounded-lg px-4 py-2 transition-colors"
          >
            New crawl
          </button>
        </div>
      </div>

      {/* Progress */}
      {isRunning && (
        <div className="rounded-xl border border-blue-700/50 bg-blue-900/20 p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Spinner size="h-4 w-4" />
            <span className="text-sm font-semibold text-blue-300">Crawl in progress — polling every 5 seconds</span>
          </div>
          <ProgressBar value={stats.complete + stats.failed} total={stats.total} label="Pages analysed" color="bg-blue-500" />
          <p className="text-xs text-blue-400/70">Pages queued: {stats.pending} · Processing: {stats.processing} · Failed: {stats.failed}</p>
        </div>
      )}

      {/* Overall risk (completed jobs) */}
      {isComplete && job.overall_risk_score !== null && (
        <div className={`rounded-xl border p-6 ${
          job.overall_risk_level === 'low' ? 'border-emerald-700 bg-emerald-900/20' :
          job.overall_risk_level === 'medium' ? 'border-yellow-700 bg-yellow-900/20' :
          job.overall_risk_level === 'high' ? 'border-orange-700 bg-orange-900/20' :
          'border-red-700 bg-red-900/20'
        }`}>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Overall Risk Score</p>
              <div className={`text-6xl font-black leading-none ${riskScoreColor(job.overall_risk_score)}`}>
                {job.overall_risk_score}<span className="text-xl text-gray-600 font-normal">/10</span>
              </div>
              <div className="mt-2 flex justify-center"><RiskBadge level={job.overall_risk_level as RiskLevel} /></div>
            </div>
            <div className="hidden sm:block w-px h-16 bg-white/10" />
            <div className="flex-1">
              <p className="text-sm text-gray-400">
                Crawl complete. {stats.complete} pages analysed, {stats.clinical} with clinical content, {stats.highRisk} high/critical risk.
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Completed: {job.completed_at ? new Date(job.completed_at).toLocaleString('en-GB') : '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total pages" value={stats.total} sub={`${analysedPct}% analysed`} />
        <StatCard label="Analysed" value={stats.complete} sub="complete" accent="text-emerald-400" />
        <StatCard
          label="Clinical pages"
          value={stats.clinical}
          sub={`${stats.total > 0 ? Math.round((stats.clinical / stats.total) * 100) : 0}% of total`}
          accent="text-indigo-400"
        />
        <StatCard
          label="High / critical risk"
          value={stats.highRisk}
          sub={`${stats.clinical > 0 ? Math.round((stats.highRisk / stats.clinical) * 100) : 0}% of clinical`}
          accent={stats.highRisk > 0 ? 'text-red-400' : 'text-gray-400'}
        />
      </div>

      {/* Pages table */}
      <div>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Analysed Pages</p>
          <div className="flex items-center gap-2 flex-wrap">
            {(['all', 'clinical', 'high', 'critical'] as PageFilter[]).map(f => (
              <button
                key={f}
                onClick={() => loadFilteredPages(f)}
                disabled={loadingPages}
                className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition-colors ${
                  filter === f
                    ? 'bg-white text-black border-white'
                    : 'border-white/20 text-gray-400 hover:border-white/40 hover:text-white'
                }`}
              >
                {f === 'all' ? 'All pages' : f === 'clinical' ? 'Clinical only' : f === 'high' ? 'High risk' : 'Critical'}
              </button>
            ))}
            {pages.length === 0 && !loadingPages && (isComplete || stats.complete > 0) && (
              <button
                onClick={() => loadFilteredPages(filter)}
                className="text-xs px-3 py-1.5 rounded-lg border border-blue-700 text-blue-400 hover:bg-blue-900/20 transition-colors"
              >
                Load results
              </button>
            )}
          </div>
        </div>

        {loadingPages ? (
          <div className="flex items-center gap-2 text-gray-500 text-sm py-8 justify-center">
            <Spinner size="h-4 w-4" />Loading pages...
          </div>
        ) : pages.length > 0 ? (
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {pages.map(p => <PageRow key={p.id} page={p} />)}
            {pages.length === 200 && (
              <p className="text-xs text-gray-600 text-center py-2">Showing first 200 results. Use filters or download the full report for all pages.</p>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
            <p className="text-gray-500 text-sm">
              {isRunning
                ? 'Pages will appear here as they are analysed.'
                : 'No pages match the current filter.'}
            </p>
            {isRunning && (
              <p className="text-gray-600 text-xs mt-1">Click "Load results" when analysis is underway.</p>
            )}
          </div>
        )}
      </div>

      {isFailed && job.error && (
        <div className="rounded-xl border border-red-700 bg-red-900/20 p-5">
          <p className="text-sm font-semibold text-red-300 mb-1">Job failed</p>
          <p className="text-sm text-red-400">{job.error}</p>
        </div>
      )}
    </div>
  )
}

// ─── Tier gate ─────────────────────────────────────────────────────────────────

function TierGate({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <div className="max-w-2xl mx-auto px-6 py-20 text-center">
      <div className="w-16 h-16 rounded-2xl border border-blue-700 bg-blue-900/20 flex items-center justify-center mx-auto mb-6">
        <svg className="w-7 h-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-white mb-3">Full Site Analysis — £150 + VAT</h2>
      <p className="text-gray-400 mb-8 leading-relaxed">
        Complete crawl of your entire website with AI clinical risk analysis on every page. Unlimited pages, sitemap discovery, priority risk ranking, and a comprehensive downloadable report.
      </p>
      <div className="space-y-3 mb-8 text-left max-w-sm mx-auto">
        {[
          'Full site crawl (unlimited pages)',
          'Sitemap discovery & validation',
          'Clinical page identification',
          'Priority risk ranking by severity',
          'Comprehensive Word report',
        ].map((f, i) => (
          <div key={i} className="flex items-center gap-2.5 text-sm text-gray-300">
            <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {f}
          </div>
        ))}
      </div>
      <button
        onClick={onUpgrade}
        className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-sm bg-white text-black hover:bg-gray-100 hover:scale-[1.02] transition-all shadow-lg shadow-white/10"
      >
        View Pricing & Unlock
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
      </button>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function FullSiteChecker({ tier = 1, onUpgrade = () => {} }: { tier?: number; onUpgrade?: () => void }) {
  const [url, setUrl] = useState('')
  const [starting, setStarting] = useState(false)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [startError, setStartError] = useState<string | null>(null)

  // Gate: tier 2+ required
  if (tier < 2) {
    return <TierGate onUpgrade={onUpgrade} />
  }

  async function handleStart() {
    const trimmed = url.trim()
    if (!trimmed || starting) return
    setStarting(true)
    setStartError(null)
    try {
      const res = await fetch('/api/jobs/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
      setActiveJobId(data.jobId)
    } catch (e: unknown) {
      setStartError(e instanceof Error ? e.message : 'Failed to start crawl')
    } finally {
      setStarting(false)
    }
  }

  if (activeJobId) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-10">
        <ActiveJob jobId={activeJobId} onReset={() => { setActiveJobId(null); setUrl('') }} />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-10 text-center">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Full Site Analysis</p>
        <h2 className="text-4xl font-bold text-white mb-3">Crawl & Analyse Your Entire Website</h2>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          Queue every page of an NHS or healthcare website for individual AI risk analysis. Results are stored in Supabase and processed in the background via Vercel Cron.
        </p>
      </div>

      {/* How it works */}
      <div className="grid sm:grid-cols-3 gap-px bg-white/5 rounded-2xl overflow-hidden border border-white/10 mb-10">
        {[
          { n: '1', title: 'Discover all pages', body: 'Reads your sitemap or crawls from the homepage to queue every URL on the domain.' },
          { n: '2', title: 'AI analyses each page', body: 'Claude Haiku evaluates every page individually for clinical content, misrepresentation risk and recommendations.' },
          { n: '3', title: 'Review & export', body: 'Filter by risk level, expand any page for full detail, and download a comprehensive Word report.' },
        ].map(({ n, title, body }) => (
          <div key={n} className="bg-black p-6">
            <div className="w-8 h-8 rounded-lg border border-white/20 flex items-center justify-center text-white font-bold text-sm mb-4">{n}</div>
            <h3 className="text-white font-semibold mb-2">{title}</h3>
            <p className="text-gray-500 text-sm leading-relaxed">{body}</p>
          </div>
        ))}
      </div>

      {/* URL input */}
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleStart() }}
            placeholder="https://www.your-trust.nhs.uk/"
            disabled={starting}
            className="flex-1 px-5 py-4 rounded-xl border border-white/20 bg-white/5 text-white placeholder-gray-600 text-sm font-mono focus:outline-none focus:border-blue-500 focus:bg-white/10 disabled:opacity-50 transition-all"
          />
          <button
            onClick={handleStart}
            disabled={starting || !url.trim()}
            className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: starting || !url.trim() ? '#374151' : '#ffffff',
              color: starting || !url.trim() ? '#9ca3af' : '#000000',
            }}
          >
            {starting
              ? <><Spinner />Starting crawl...</>
              : <>Start Full Site Analysis <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg></>
            }
          </button>
        </div>

        {startError && (
          <div className="mb-4 border border-red-700 bg-red-900/20 rounded-xl p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <div>
              <p className="font-semibold text-red-300 text-sm mb-0.5">Failed to start crawl</p>
              <p className="text-sm text-red-400">{startError}</p>
            </div>
          </div>
        )}

        {/* Environment note */}
        <div className="p-4 rounded-xl border border-white/10 bg-white/5 mb-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Before you start</p>
          <ul className="space-y-1 text-xs text-gray-500">
            <li className="flex items-start gap-2"><span className="text-gray-600 flex-shrink-0">›</span> Requires <code className="bg-black/40 px-1 py-0.5 rounded text-gray-400">SUPABASE_URL</code> and <code className="bg-black/40 px-1 py-0.5 rounded text-gray-400">SUPABASE_SERVICE_KEY</code> environment variables to be set in Vercel.</li>
            <li className="flex items-start gap-2"><span className="text-gray-600 flex-shrink-0">›</span> Run <code className="bg-black/40 px-1 py-0.5 rounded text-gray-400">database-schema.sql</code> in your Supabase SQL editor first.</li>
            <li className="flex items-start gap-2"><span className="text-gray-600 flex-shrink-0">›</span> The Vercel Cron (<code className="bg-black/40 px-1 py-0.5 rounded text-gray-400">/api/cron/crawl</code>) runs every minute and processes pages in the background.</li>
            <li className="flex items-start gap-2"><span className="text-gray-600 flex-shrink-0">›</span> Large sites (500+ pages) may take 30–60 minutes to fully analyse.</li>
          </ul>
        </div>

        {/* Previous jobs */}
        <PastJobsList onSelect={id => setActiveJobId(id)} />
      </div>
    </div>
  )
}
