import { useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RobotsTxtAnalysis {
  exists: boolean
  summary: string
  aiProtection: 'none' | 'partial' | 'good'
  allowsAIScraping: boolean
  keyDirectives: string[]
  recommendation: string
}

interface StructuredDataAnalysis {
  found: boolean
  types: string[]
  quality: 'none' | 'poor' | 'basic' | 'good' | 'excellent'
  summary: string
  aiImpact: string
  recommendation: string
}

interface ClinicalAnalysis {
  hasClinicalContent: boolean
  contentTypes: string[]
  accuracy: string
  misrepresentationRisk: 'low' | 'medium' | 'high' | 'critical'
  misrepresentationConcerns: string[]
  outOfContextRisks: string[]
  recommendation: string
}

interface OverallRisk {
  score: number
  level: 'low' | 'medium' | 'high' | 'critical'
  summary: string
  topConcerns: string[]
  immediateActions: string[]
}

interface ScrapingProfile {
  whatAIWouldExtract: string[]
  howItWouldBeUsed: string
  potentialHarms: string[]
}

interface Analysis {
  robotsTxt: RobotsTxtAnalysis
  structuredData: StructuredDataAnalysis
  clinicalInformation: ClinicalAnalysis
  overallRisk: OverallRisk
  scrapingProfile: ScrapingProfile
}

interface ScrapeResult {
  url: string
  title: string
  robotsTxt: string | null
  structuredData: object[]
  analysis: Analysis
}

// ─── Risk level helpers ───────────────────────────────────────────────────────

type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

function riskColors(level: RiskLevel) {
  switch (level) {
    case 'low':      return { text: 'text-green-700',  bg: 'bg-green-100',  border: 'border-green-200' }
    case 'medium':   return { text: 'text-yellow-700', bg: 'bg-yellow-100', border: 'border-yellow-200' }
    case 'high':     return { text: 'text-orange-700', bg: 'bg-orange-100', border: 'border-orange-200' }
    case 'critical': return { text: 'text-red-700',    bg: 'bg-red-100',    border: 'border-red-200' }
  }
}

function riskScoreColor(score: number) {
  if (score <= 3) return 'text-green-600'
  if (score <= 5) return 'text-yellow-600'
  if (score <= 7) return 'text-orange-600'
  return 'text-red-600'
}

function RiskBadge({ level, label }: { level: RiskLevel; label?: string }) {
  const c = riskColors(level)
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${c.text} ${c.bg}`}>
      {label ?? level}
    </span>
  )
}

function StatusBadge({ ok, labelTrue, labelFalse }: { ok: boolean; labelTrue: string; labelFalse: string }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
      <span>&#10003;</span> {labelTrue}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
      <span>&#10007;</span> {labelFalse}
    </span>
  )
}

function QualityBadge({ quality }: { quality: StructuredDataAnalysis['quality'] }) {
  const map: Record<string, string> = {
    none:      'bg-red-100 text-red-700',
    poor:      'bg-orange-100 text-orange-700',
    basic:     'bg-yellow-100 text-yellow-700',
    good:      'bg-green-100 text-green-700',
    excellent: 'bg-emerald-100 text-emerald-700',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${map[quality] ?? 'bg-gray-100 text-gray-600'}`}>
      {quality}
    </span>
  )
}

function ProtectionBadge({ level }: { level: RobotsTxtAnalysis['aiProtection'] }) {
  const map: Record<string, string> = {
    none:    'bg-red-100 text-red-700',
    partial: 'bg-yellow-100 text-yellow-700',
    good:    'bg-green-100 text-green-700',
  }
  const labels: Record<string, string> = {
    none: 'No AI Protection', partial: 'Partial Protection', good: 'Good Protection'
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${map[level]}`}>
      {labels[level]}
    </span>
  )
}

function RecommendationBox({ text }: { text: string }) {
  return (
    <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
      <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-1">Recommendation</p>
      <p className="text-sm text-blue-900">{text}</p>
    </div>
  )
}

// ─── Analysis Cards ───────────────────────────────────────────────────────────

function RobotsTxtCard({ data }: { data: RobotsTxtAnalysis }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 text-sm font-bold flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <h3 className="font-semibold text-gray-900">robots.txt</h3>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <StatusBadge ok={data.exists} labelTrue="Found" labelFalse="Missing" />
        <ProtectionBadge level={data.aiProtection} />
        {!data.allowsAIScraping && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
            AI Scraping Restricted
          </span>
        )}
        {data.allowsAIScraping && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
            AI Scraping Allowed
          </span>
        )}
      </div>

      <p className="text-sm text-gray-700 leading-relaxed mb-3">{data.summary}</p>

      {data.keyDirectives.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Key Directives</p>
          <ul className="space-y-1">
            {data.keyDirectives.map((d, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-gray-400 mt-0.5 flex-shrink-0">&#8250;</span>
                <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-800 break-all">{d}</code>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-auto">
        <RecommendationBox text={data.recommendation} />
      </div>
    </div>
  )
}

function StructuredDataCard({ data }: { data: StructuredDataAnalysis }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        </div>
        <h3 className="font-semibold text-gray-900">Structured Data</h3>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <StatusBadge ok={data.found} labelTrue="Found" labelFalse="Not Found" />
        <QualityBadge quality={data.quality} />
      </div>

      {data.types.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {data.types.map((t, i) => (
            <span key={i} className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full font-mono">
              {t}
            </span>
          ))}
        </div>
      )}

      <p className="text-sm text-gray-700 leading-relaxed mb-2">{data.summary}</p>
      <p className="text-sm text-gray-600 leading-relaxed italic mb-3">{data.aiImpact}</p>

      <div className="mt-auto">
        <RecommendationBox text={data.recommendation} />
      </div>
    </div>
  )
}

function ClinicalCard({ data }: { data: ClinicalAnalysis }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="font-semibold text-gray-900">Clinical Information</h3>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <StatusBadge ok={data.hasClinicalContent} labelTrue="Clinical Content Found" labelFalse="No Clinical Content" />
        <RiskBadge level={data.misrepresentationRisk} label={`${data.misrepresentationRisk} risk`} />
      </div>

      {data.contentTypes.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Content Types</p>
          <ul className="space-y-1">
            {data.contentTypes.map((t, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.misrepresentationConcerns.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Misrepresentation Concerns</p>
          <ul className="space-y-1.5">
            {data.misrepresentationConcerns.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-orange-500 flex-shrink-0 mt-0.5">&#9888;</span>
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.outOfContextRisks.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Out-of-Context Risks</p>
          <ul className="space-y-1.5">
            {data.outOfContextRisks.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-red-500 flex-shrink-0 mt-0.5">&#8226;</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-auto">
        <RecommendationBox text={data.recommendation} />
      </div>
    </div>
  )
}

function ScrapingProfileCard({ data }: { data: ScrapingProfile }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="font-semibold text-gray-900">AI Scraping Profile</h3>
      </div>

      {data.whatAIWouldExtract.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">What AI Would Extract</p>
          <ul className="space-y-1.5">
            {data.whatAIWouldExtract.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-blue-500 flex-shrink-0 mt-0.5">&#8226;</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">How It Would Be Used</p>
        <p className="text-sm text-gray-700 leading-relaxed">{data.howItWouldBeUsed}</p>
      </div>

      {data.potentialHarms.length > 0 && (
        <div className="mt-auto">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Potential Harms</p>
          <ul className="space-y-1.5">
            {data.potentialHarms.map((h, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-red-500 flex-shrink-0 mt-0.5">&#9888;</span>
                {h}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ─── Spinner ─────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ScrapeResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleAnalyse() {
    const trimmed = url.trim()
    if (!trimmed || loading) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
      setResult(data as ScrapeResult)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const risk = result?.analysis.overallRisk

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <header style={{ backgroundColor: '#005EB8' }} className="w-full shadow-md">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-white leading-tight">BHFT Website AI Risk Checker</h1>
          <p className="text-sm text-blue-200 mt-0.5">Berkshire Healthcare NHS Foundation Trust</p>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Input card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-gray-600 text-sm leading-relaxed mb-5">
            Analyse any website to understand how AI scraping tools would interpret its content, what data they would extract,
            and the risks of misrepresentation — particularly for clinical information.
          </p>

          <div className="flex gap-3 flex-col sm:flex-row">
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAnalyse() }}
              placeholder="https://www.example.nhs.uk"
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400 font-mono"
            />
            <button
              onClick={handleAnalyse}
              disabled={loading || !url.trim()}
              style={{ backgroundColor: loading || !url.trim() ? '#94a3b8' : '#005EB8' }}
              className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-white text-sm font-semibold transition-colors disabled:cursor-not-allowed sm:w-auto w-full"
            >
              {loading ? (
                <>
                  <Spinner />
                  Analysing...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Analyse Website
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-red-600 font-semibold text-sm">Analysis failed</span>
            </div>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 flex flex-col items-center justify-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
            </div>
            <p className="text-gray-600 font-medium">Analysing website...</p>
            <p className="text-gray-400 text-sm text-center max-w-xs">
              Fetching robots.txt, parsing structured data, and running AI risk analysis. This may take 15-30 seconds.
            </p>
          </div>
        )}

        {/* Results */}
        {result && !loading && risk && (
          <>
            {/* Overall Risk Score */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Overall AI Risk Score</p>
              <div className={`text-6xl font-extrabold mb-2 ${riskScoreColor(risk.score)}`}>
                {risk.score}<span className="text-2xl text-gray-400 font-normal">/10</span>
              </div>
              <div className="flex justify-center mb-4">
                <RiskBadge level={risk.level} />
              </div>
              <p className="text-gray-700 text-sm leading-relaxed max-w-xl mx-auto mb-4">{risk.summary}</p>
              <div className="text-xs text-gray-500 space-y-0.5">
                <p className="font-semibold text-gray-700 truncate">{result.title}</p>
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline font-mono break-all"
                >
                  {result.url}
                </a>
              </div>
            </div>

            {/* 4 Analysis Cards - 2x2 grid on desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <RobotsTxtCard data={result.analysis.robotsTxt} />
              <StructuredDataCard data={result.analysis.structuredData} />
              <ClinicalCard data={result.analysis.clinicalInformation} />
              <ScrapingProfileCard data={result.analysis.scrapingProfile} />
            </div>

            {/* Immediate Actions */}
            {risk.immediateActions.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-orange-500 text-xl">&#9888;</span>
                  <h3 className="font-semibold text-gray-900">Immediate Actions Required</h3>
                </div>
                <ol className="space-y-3">
                  {risk.immediateActions.map((action, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span
                        style={{ backgroundColor: '#005EB8' }}
                        className="flex-shrink-0 w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center"
                      >
                        {i + 1}
                      </span>
                      <p className="text-sm text-gray-700 leading-relaxed pt-0.5">{action}</p>
                    </li>
                  ))}
                </ol>

                {risk.topConcerns.length > 0 && (
                  <div className="mt-5 pt-5 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Top Concerns</p>
                    <ul className="space-y-2">
                      {risk.topConcerns.map((concern, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                          <span className="text-red-500 flex-shrink-0 mt-0.5">&#8226;</span>
                          {concern}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-gray-200 bg-white">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <p className="text-xs text-gray-400">BHFT Website AI Risk Checker &middot; Internal governance use</p>
          <p className="text-xs text-gray-400">Powered by Claude AI</p>
        </div>
      </footer>
    </div>
  )
}
