import { useState, useEffect, useCallback } from 'react'
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  BorderStyle, AlignmentType,
} from 'docx'

// ─── Types ────────────────────────────────────────────────────────────────────

type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

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

interface RewriteResult {
  url: string
  title: string | null
  original: string
  rewrittenTitle: string
  rewrittenContent: string
  keyChanges: string[]
  clinicalCaveatsAdded: string[]
  suggestedMetaDescription: string
  suggestedJsonLd: object
  robotsTxtAdditions: string
  complianceNotes: string[]
  readabilityScore: string
}

interface PageRewriteState {
  status: 'idle' | 'loading' | 'done' | 'error'
  result: RewriteResult | null
  error: string | null
  activeTab: 'original' | 'rewritten'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function riskColors(level: RiskLevel | null) {
  switch (level) {
    case 'low':      return { text: 'text-emerald-400', bg: 'bg-emerald-900/30', border: 'border-emerald-700' }
    case 'medium':   return { text: 'text-yellow-400',  bg: 'bg-yellow-900/30',  border: 'border-yellow-700' }
    case 'high':     return { text: 'text-orange-400',  bg: 'bg-orange-900/30',  border: 'border-orange-700' }
    case 'critical': return { text: 'text-red-400',     bg: 'bg-red-900/30',     border: 'border-red-700' }
    default:         return { text: 'text-gray-400',    bg: 'bg-gray-900/30',    border: 'border-gray-700' }
  }
}

function Spinner({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'w-8 h-8 border-4' : 'w-4 h-4 border-2'
  return <div className={`${cls} border-current border-t-transparent rounded-full animate-spin`} />
}

// ─── Word Document Generator ───────────────────────────────────────────────────

function heading1(text: string) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    border: { bottom: { color: '005EB8', size: 6, style: BorderStyle.SINGLE, space: 4 } },
  })
}

function heading2(text: string) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 120 } })
}

function para(text: string, opts: { bold?: boolean; size?: number; color?: string; italic?: boolean } = {}) {
  return new Paragraph({
    children: [new TextRun({ text, bold: opts.bold, size: opts.size ?? 22, color: opts.color, italics: opts.italic })],
    spacing: { after: 80 },
  })
}

function bullet(text: string) {
  return new Paragraph({
    children: [new TextRun({ text, size: 20 })],
    bullet: { level: 0 },
    spacing: { after: 60 },
  })
}

async function generateRepairDocument(rewrites: RewriteResult[], domain: string) {
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const children: Paragraph[] = []

  // Cover
  children.push(
    new Paragraph({
      children: [new TextRun({ text: 'NHS Clinical Content Repair Package', bold: true, size: 48, color: '005EB8' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: domain, size: 28, color: '374151' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Generated: ${date}`, size: 22, color: '6B7280', italics: true })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
  )

  // Executive Summary
  children.push(
    heading1('Executive Summary'),
    para(`This package contains AI-rewritten clinical content for ${rewrites.length} page(s) on ${domain}. Each page has been rewritten to comply with NHS Digital Service Manual standards, DCB0129 clinical safety requirements, and plain English guidelines.`, { size: 22 }),
    para(`All rewrites include clinical caveats, AI scraping protections, and structured data recommendations.`, { size: 22 }),
    new Paragraph({ text: '', spacing: { after: 200 } }),
  )

  // Per-page content
  for (const [i, rw] of rewrites.entries()) {
    children.push(
      heading1(`Page ${i + 1}: ${rw.rewrittenTitle || rw.title || 'Untitled'}`),
      para(`URL: ${rw.url}`, { bold: true, size: 20, color: '374151' }),
      new Paragraph({ text: '', spacing: { after: 80 } }),

      heading2('Original Content'),
      para(rw.original.substring(0, 1500), { size: 18, italic: true, color: '6B7280' }),

      heading2('Rewritten Content (NHS Standard)'),
      para(rw.rewrittenContent.substring(0, 3000), { size: 20 }),

      heading2('Key Changes Made'),
      ...(rw.keyChanges || []).map(c => bullet(c)),

      heading2('Clinical Caveats Added'),
      ...(rw.clinicalCaveatsAdded || []).map(c => bullet(c)),

      heading2('Suggested Meta Description'),
      para(rw.suggestedMetaDescription || '', { size: 20, italic: true }),

      heading2('robots.txt Additions'),
      para(rw.robotsTxtAdditions || '', { size: 18, color: '1D4ED8' }),

      heading2('Compliance Notes'),
      ...(rw.complianceNotes || []).map(c => bullet(c)),

      para(`Readability: ${rw.readabilityScore}`, { size: 18, color: '059669' }),
      new Paragraph({ text: '', spacing: { after: 400 } }),
    )
  }

  // Implementation Checklist
  children.push(
    heading1('Implementation Checklist'),
    ...[
      'Replace page content with rewritten versions',
      'Add suggested JSON-LD structured data to each page',
      'Update robots.txt with all suggested AI-protection directives',
      'Update meta descriptions on each rewritten page',
      'Run a final clinical safety review before publishing',
      'Submit updated sitemap to Google Search Console',
      'Review with clinical safety officer (DCB0129)',
    ].map(item => bullet(item)),
  )

  // Complete robots.txt
  const allRobotsTxt = [...new Set(rewrites.map(r => r.robotsTxtAdditions).filter(Boolean))].join('\n')
  if (allRobotsTxt) {
    children.push(
      heading1('Complete robots.txt Additions'),
      para('Add the following lines to your robots.txt file:', { size: 20 }),
      para(allRobotsTxt, { size: 18, color: '1D4ED8' }),
    )
  }

  const doc = new Document({
    sections: [{ children }],
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22 },
        },
      },
    },
  })

  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `nhs-repair-package-${domain.replace(/[^a-z0-9]/gi, '-')}-${Date.now()}.docx`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Rewritten Content Renderer ────────────────────────────────────────────────

function RewrittenContentView({ content }: { content: string }) {
  const lines = content.split('\n')
  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        if (line.startsWith('## ')) {
          return <h3 key={i} className="text-white font-bold text-base mt-4 mb-1">{line.replace('## ', '')}</h3>
        }
        if (line.startsWith('# ')) {
          return <h2 key={i} className="text-white font-bold text-lg mt-5 mb-2">{line.replace('# ', '')}</h2>
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <div key={i} className="flex items-start gap-2 text-sm text-gray-300">
              <span className="text-gray-500 flex-shrink-0 mt-0.5">•</span>
              <span>{line.replace(/^[-*] /, '').replace(/\*\*(.*?)\*\*/g, '$1')}</span>
            </div>
          )
        }
        if (line.trim() === '') return <div key={i} className="h-2" />
        return <p key={i} className="text-sm text-gray-300 leading-relaxed">{line.replace(/\*\*(.*?)\*\*/g, '$1')}</p>
      })}
    </div>
  )
}

// ─── Individual Page Row ───────────────────────────────────────────────────────

function PageRow({
  page,
  state,
  onRewrite,
}: {
  page: CrawlPage
  state: PageRewriteState
  onRewrite: (page: CrawlPage) => void
}) {
  const [localTab, setLocalTab] = useState<'original' | 'rewritten'>('original')
  const c = riskColors(page.misrepresentation_risk)
  const hasResult = state.status === 'done' && state.result

  return (
    <div className={`rounded-xl border ${hasResult ? 'border-emerald-700/50' : 'border-white/10'} bg-white/5 overflow-hidden`}>
      {/* Header Row */}
      <div className="flex items-start justify-between gap-4 p-5">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide border ${c.text} ${c.bg} ${c.border}`}>
              {page.misrepresentation_risk || 'unknown'}
            </span>
            {hasResult && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-900/30 text-emerald-400 border border-emerald-700">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Rewritten
              </span>
            )}
          </div>
          <p className="text-white font-semibold text-sm truncate">{page.title || 'Untitled Page'}</p>
          <p className="text-gray-500 text-xs font-mono truncate mt-0.5">{page.url}</p>
          {page.clinical_content_types && page.clinical_content_types.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {page.clinical_content_types.map((t, i) => (
                <span key={i} className="text-xs px-2 py-0.5 bg-indigo-900/40 text-indigo-300 border border-indigo-700 rounded-full font-mono">{t}</span>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => onRewrite(page)}
          disabled={state.status === 'loading'}
          className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all bg-white text-black hover:bg-gray-100 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
        >
          {state.status === 'loading' ? (
            <><Spinner />Rewriting...</>
          ) : hasResult ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Re-rewrite
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Rewrite
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {state.status === 'error' && state.error && (
        <div className="mx-5 mb-4 p-3 rounded-lg border border-red-700 bg-red-900/20 text-red-400 text-xs">
          {state.error}
        </div>
      )}

      {/* Before/After comparison */}
      {hasResult && state.result && (
        <div className="border-t border-white/10">
          {/* Tab switcher */}
          <div className="flex border-b border-white/10">
            {(['original', 'rewritten'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setLocalTab(tab)}
                className={`px-5 py-2.5 text-xs font-semibold uppercase tracking-wide transition-all border-b-2 ${
                  localTab === tab
                    ? 'text-white border-white'
                    : 'text-gray-500 border-transparent hover:text-gray-300'
                }`}
              >
                {tab === 'original' ? 'Original' : 'Rewritten (NHS Standard)'}
              </button>
            ))}
          </div>

          <div className="p-5">
            {localTab === 'original' ? (
              <div className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
                {state.result.original.substring(0, 2000)}
                {state.result.original.length > 2000 && <span className="text-gray-600"> [truncated]</span>}
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto">
                <RewrittenContentView content={state.result.rewrittenContent} />
              </div>
            )}
          </div>

          {/* Meta & changes summary */}
          <div className="border-t border-white/10 px-5 py-4 bg-white/[0.02]">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Key Changes</p>
                <ul className="space-y-1">
                  {(state.result.keyChanges || []).slice(0, 4).map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
                      <span className="text-emerald-500 flex-shrink-0 mt-0.5">✓</span>
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Clinical Caveats Added</p>
                <ul className="space-y-1">
                  {(state.result.clinicalCaveatsAdded || []).slice(0, 3).map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
                      <span className="text-blue-400 flex-shrink-0 mt-0.5">+</span>
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {state.result.readabilityScore && (
              <p className="text-xs text-emerald-400 mt-3 font-medium">
                Readability: {state.result.readabilityScore}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface ContentRewriterProps {
  jobId: string
}

export default function ContentRewriter({ jobId }: ContentRewriterProps) {
  const [pages, setPages] = useState<CrawlPage[]>([])
  const [loadingPages, setLoadingPages] = useState(true)
  const [pagesError, setPagesError] = useState<string | null>(null)
  const [jobDomain, setJobDomain] = useState('')
  const [rewriteStates, setRewriteStates] = useState<Record<string, PageRewriteState>>({})
  const [bulkRewriting, setBulkRewriting] = useState(false)
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 })
  const [downloadingReport, setDownloadingReport] = useState(false)

  // Load clinical pages for this job
  useEffect(() => {
    if (!jobId) return
    setLoadingPages(true)
    setPagesError(null)
    fetch(`/api/jobs/status?id=${jobId}&pages=true&clinicalOnly=true`)
      .then(r => r.json())
      .then(data => {
        if (data.pages) setPages(data.pages)
        if (data.job?.domain) setJobDomain(data.job.domain)
        setLoadingPages(false)
      })
      .catch(e => {
        setPagesError(e.message || 'Failed to load pages')
        setLoadingPages(false)
      })
  }, [jobId])

  const rewritePage = useCallback(async (page: CrawlPage) => {
    setRewriteStates(prev => ({
      ...prev,
      [page.id]: { status: 'loading', result: null, error: null, activeTab: 'original' },
    }))

    try {
      const res = await fetch('/api/rewrite/page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: page.url,
          title: page.title,
          content: page.page_summary || page.recommendation || `Clinical page: ${page.title}\n\nRisk: ${page.misrepresentation_risk}\n\nContent types: ${(page.clinical_content_types || []).join(', ')}`,
          concerns: page.misrepresentation_concerns || [],
          contentTypes: page.clinical_content_types || [],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Rewrite failed')

      setRewriteStates(prev => ({
        ...prev,
        [page.id]: { status: 'done', result: data, error: null, activeTab: 'rewritten' },
      }))
    } catch (e: unknown) {
      setRewriteStates(prev => ({
        ...prev,
        [page.id]: { status: 'error', result: null, error: e instanceof Error ? e.message : 'Unknown error', activeTab: 'original' },
      }))
    }
  }, [])

  async function handleRewriteAll() {
    if (pages.length === 0) return
    setBulkRewriting(true)
    setBulkProgress({ done: 0, total: pages.length })
    for (const page of pages) {
      await rewritePage(page)
      setBulkProgress(prev => ({ ...prev, done: prev.done + 1 }))
    }
    setBulkRewriting(false)
  }

  async function handleDownloadAll() {
    const completed = Object.entries(rewriteStates)
      .filter(([, s]) => s.status === 'done' && s.result)
      .map(([, s]) => s.result as RewriteResult)

    if (completed.length === 0) return

    setDownloadingReport(true)
    try {
      await generateRepairDocument(completed, jobDomain || 'healthcare-site')
    } catch (e) {
      console.error('Download failed', e)
    } finally {
      setDownloadingReport(false)
    }
  }

  const completedCount = Object.values(rewriteStates).filter(s => s.status === 'done').length
  const criticalAndHigh = pages.filter(p => p.misrepresentation_risk === 'critical' || p.misrepresentation_risk === 'high')
  const sortedPages = [
    ...pages.filter(p => p.misrepresentation_risk === 'critical'),
    ...pages.filter(p => p.misrepresentation_risk === 'high'),
    ...pages.filter(p => p.misrepresentation_risk === 'medium'),
    ...pages.filter(p => p.misrepresentation_risk === 'low'),
    ...pages.filter(p => !p.misrepresentation_risk),
  ]

  if (loadingPages) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-5">
        <Spinner size="lg" />
        <div className="text-center">
          <p className="text-white font-semibold">Loading clinical pages...</p>
          <p className="text-gray-500 text-sm mt-1">Fetching pages that need rewriting</p>
        </div>
      </div>
    )
  }

  if (pagesError) {
    return (
      <div className="border border-red-700 bg-red-900/20 rounded-xl p-5 flex items-start gap-3">
        <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="font-semibold text-red-300 text-sm mb-1">Failed to load pages</p>
          <p className="text-sm text-red-400">{pagesError}</p>
        </div>
      </div>
    )
  }

  if (pages.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-14 h-14 rounded-full border border-white/10 bg-white/5 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-white font-semibold mb-2">No clinical pages found</p>
        <p className="text-gray-500 text-sm">This job has no pages with clinical content identified, so there is nothing to rewrite.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header & controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Clinical Page Rewriter</h2>
          <p className="text-gray-400 text-sm">
            {pages.length} clinical page{pages.length !== 1 ? 's' : ''} found
            {criticalAndHigh.length > 0 && (
              <span className="text-red-400 ml-2">· {criticalAndHigh.length} high/critical priority</span>
            )}
            {completedCount > 0 && (
              <span className="text-emerald-400 ml-2">· {completedCount} rewritten</span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {completedCount > 0 && (
            <button
              onClick={handleDownloadAll}
              disabled={downloadingReport}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all bg-white text-black hover:bg-gray-100 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {downloadingReport ? (
                <><Spinner />Generating...</>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download Repair Package ({completedCount})
                </>
              )}
            </button>
          )}

          <button
            onClick={handleRewriteAll}
            disabled={bulkRewriting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all border border-white/20 bg-white/5 text-white hover:bg-white/10 hover:border-white/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {bulkRewriting ? (
              <><Spinner />Rewriting {bulkProgress.done}/{bulkProgress.total}...</>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Rewrite All ({pages.length})
              </>
            )}
          </button>
        </div>
      </div>

      {/* Bulk progress bar */}
      {bulkRewriting && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-white font-semibold">Rewriting clinical pages...</p>
            <p className="text-sm text-gray-400">{bulkProgress.done} / {bulkProgress.total}</p>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${bulkProgress.total > 0 ? (bulkProgress.done / bulkProgress.total) * 100 : 0}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">Each page is processed sequentially by the AI. This may take several minutes for large sites.</p>
        </div>
      )}

      {/* Pages list */}
      <div className="space-y-4">
        {sortedPages.map(page => (
          <PageRow
            key={page.id}
            page={page}
            state={rewriteStates[page.id] || { status: 'idle', result: null, error: null, activeTab: 'original' }}
            onRewrite={rewritePage}
          />
        ))}
      </div>

      {/* Download prompt after all done */}
      {completedCount === pages.length && pages.length > 0 && !bulkRewriting && (
        <div className="rounded-xl border border-emerald-700 bg-emerald-900/20 p-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-emerald-300 font-bold mb-1">All {pages.length} pages rewritten</p>
            <p className="text-emerald-400/70 text-sm">Download your complete NHS repair package including all before/after content, JSON-LD, and robots.txt additions.</p>
          </div>
          <button
            onClick={handleDownloadAll}
            disabled={downloadingReport}
            className="flex-shrink-0 flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all bg-white text-black hover:bg-gray-100 disabled:opacity-50"
          >
            {downloadingReport ? <><Spinner />Generating...</> : 'Download Repair Package'}
          </button>
        </div>
      )}
    </div>
  )
}
