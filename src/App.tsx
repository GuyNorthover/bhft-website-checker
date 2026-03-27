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
    case 'low':      return { text: 'text-green-700',  bg: 'bg-green-100',  border: 'border-green-200', dot: 'bg-green-500' }
    case 'medium':   return { text: 'text-yellow-700', bg: 'bg-yellow-100', border: 'border-yellow-200', dot: 'bg-yellow-500' }
    case 'high':     return { text: 'text-orange-700', bg: 'bg-orange-100', border: 'border-orange-200', dot: 'bg-orange-500' }
    case 'critical': return { text: 'text-red-700',    bg: 'bg-red-100',    border: 'border-red-200', dot: 'bg-red-500' }
  }
}

function riskScoreColor(score: number) {
  if (score <= 3) return 'text-green-600'
  if (score <= 5) return 'text-yellow-600'
  if (score <= 7) return 'text-orange-600'
  return 'text-red-600'
}

function riskScoreBg(score: number) {
  if (score <= 3) return 'from-green-50 to-green-100 border-green-200'
  if (score <= 5) return 'from-yellow-50 to-yellow-100 border-yellow-200'
  if (score <= 7) return 'from-orange-50 to-orange-100 border-orange-200'
  return 'from-red-50 to-red-100 border-red-200'
}

function RiskBadge({ level, label }: { level: RiskLevel; label?: string }) {
  const c = riskColors(level)
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${c.text} ${c.bg} border ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {label ?? level}
    </span>
  )
}

function StatusBadge({ ok, labelTrue, labelFalse }: { ok: boolean; labelTrue: string; labelFalse: string }) {
  return ok ? (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
      {labelTrue}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
      {labelFalse}
    </span>
  )
}

function QualityBadge({ quality }: { quality: StructuredDataAnalysis['quality'] }) {
  const map: Record<string, string> = {
    none:      'bg-red-100 text-red-700 border-red-200',
    poor:      'bg-orange-100 text-orange-700 border-orange-200',
    basic:     'bg-yellow-100 text-yellow-700 border-yellow-200',
    good:      'bg-green-100 text-green-700 border-green-200',
    excellent: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  }
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide border ${map[quality] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
      {quality} quality
    </span>
  )
}

function ProtectionBadge({ level }: { level: RobotsTxtAnalysis['aiProtection'] }) {
  const map: Record<string, string> = {
    none:    'bg-red-100 text-red-700 border-red-200',
    partial: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    good:    'bg-green-100 text-green-700 border-green-200',
  }
  const labels: Record<string, string> = {
    none: 'No AI Protection', partial: 'Partial Protection', good: 'Good Protection'
  }
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide border ${map[level]}`}>
      {labels[level]}
    </span>
  )
}

function RecommendationBox({ text }: { text: string }) {
  return (
    <div className="mt-4 p-4 rounded-lg bg-blue-50 border border-blue-200">
      <div className="flex items-start gap-2">
        <svg className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-1">Recommendation</p>
          <p className="text-sm text-blue-900 leading-relaxed">{text}</p>
        </div>
      </div>
    </div>
  )
}

// ─── Why This Matters Section ─────────────────────────────────────────────────

interface RiskCardProps {
  icon: React.ReactNode
  title: string
  description: string
  reference: string
  href: string
  severity: 'high' | 'critical' | 'medium'
}

function WhyRiskCard({ icon, title, description, reference, href, severity }: RiskCardProps) {
  const colors = severity === 'critical'
    ? 'border-red-200 bg-red-50'
    : severity === 'high'
    ? 'border-orange-200 bg-orange-50'
    : 'border-yellow-200 bg-yellow-50'
  const iconBg = severity === 'critical' ? 'bg-red-100 text-red-700' : severity === 'high' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'

  return (
    <div className={`rounded-xl border p-5 ${colors}`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 text-sm mb-1.5">{title}</h4>
          <p className="text-sm text-gray-700 leading-relaxed mb-3">{description}</p>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 font-medium hover:underline"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            {reference}
          </a>
        </div>
      </div>
    </div>
  )
}

function WhyThisMatters() {
  const [expanded, setExpanded] = useState(false)

  const risks: RiskCardProps[] = [
    {
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      title: 'Clinical Content Misrepresentation — Direct Patient Safety Risk',
      description: 'AI tools "operate through statistical prediction rather than clinical reasoning." Even accurate NHS guidance can be reproduced in a misleading, incomplete, or hallucinated context. Drug dosages, contraindications, and treatment pathways are particularly vulnerable to being stripped of essential caveats.',
      reference: 'UKMi Position Statement on AI (NHS)',
      href: 'https://www.ukmi.nhs.uk/fileDownloader.aspx?ID=295',
      severity: 'critical',
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      title: 'NHSE Has Already Halted AI Projects Over Safety Failures',
      description: "NHS England's national CCIO issued an explicit order to trusts to halt 'safety risk' AI projects, warning that non-compliant AI 'risks clinical safety, data protection breaches, and financial exposure.' Your website content is a primary source AI tools draw from.",
      reference: 'HSJ — NHSE Orders Trusts to Halt Safety Risk AI',
      href: 'https://www.hsj.co.uk/technology-and-innovation/exclusive-nhse-orders-trusts-to-halt-safety-risk-ai-projects/7039515.article',
      severity: 'critical',
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
        </svg>
      ),
      title: 'Crown Copyright & AI Training — NHS Content at Risk',
      description: 'NHS website content is protected by Crown Copyright, but AI developers have sought to scrape it for model training. The UK Government paused proposed opt-out legislation in early 2026 following backlash, meaning current copyright law applies — but enforcement gaps remain significant.',
      reference: 'UK Government Copyright & AI Consultation',
      href: 'https://www.gov.uk/government/consultations/copyright-and-artificial-intelligence/copyright-and-artificial-intelligence',
      severity: 'high',
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      title: 'Clinical Safety Standards Cannot Keep Pace with AI',
      description: 'Research published in JMIR (2025) found that in a typical NHS trust, three out of four digital tools influencing patient care do not demonstrate compliance with minimum legal or clinical safety requirements. The existing DCB0129/DCB0160 standards were built for fixed-logic software and break when applied to AI systems.',
      reference: 'JMIR — NHS Clinical Safety Compliance Study (2025)',
      href: 'https://www.jmir.org/2025/1/e80076',
      severity: 'high',
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
      title: 'GDPR & Data Governance — DPIA Required Before AI Use',
      description: 'NHS Transformation Directorate guidance establishes that a Data Protection Impact Assessment (DPIA) is a legal requirement before any AI tool is deployed. Vendor terms allowing use of inputs "to enhance services" may constitute joint data controllership under UK GDPR.',
      reference: 'NHS Transformation Directorate — AI IG Guidance',
      href: 'https://transform.england.nhs.uk/information-governance/guidance/artificial-intelligence/',
      severity: 'high',
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
      ),
      title: 'NHS is the UK\'s Most Trusted Health Source — Misuse Has Outsized Impact',
      description: '48% of adults cite the NHS website as their primary health information source (Healthwatch). This public trust means AI misrepresentation of NHS content carries disproportionate public health risk — patients are less likely to question "NHS-sourced" AI outputs, even when those outputs are wrong.',
      reference: 'Healthwatch — AI and Algorithms in Healthcare',
      href: 'https://www.healthwatch.co.uk/blog/2025-11-05/ai-and-algorithms-healthcare-what-are-risks-and-opportunities-nhs',
      severity: 'medium',
    },
  ]

  const visibleRisks = expanded ? risks : risks.slice(0, 3)

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Section header */}
      <div className="px-6 pt-6 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
            <svg className="w-4 h-4 text-red-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900">Why NHS Organisations Need to Check Their Websites</h2>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">
          AI web crawlers are already scraping NHS websites and using that content to answer patient queries, train language models, and generate clinical summaries — often without the context, nuance, or accuracy that patient safety requires. The risks below are documented in published NHS England guidance and peer-reviewed research.
        </p>
      </div>

      {/* Risk cards */}
      <div className="p-6 space-y-4">
        {visibleRisks.map((risk, i) => (
          <WhyRiskCard key={i} {...risk} />
        ))}

        {/* Expand / collapse */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full mt-2 py-2.5 px-4 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition-colors flex items-center justify-center gap-2"
        >
          {expanded ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
              Show fewer risks
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              Show all {risks.length} identified risks
            </>
          )}
        </button>
      </div>

      {/* Key frameworks bar */}
      <div className="px-6 pb-5">
        <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Referenced NHS & Regulatory Frameworks</p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'NHS AI Lab Roadmap', href: 'https://transform.england.nhs.uk/ai-lab/nhs-ai-lab-roadmap/' },
              { label: 'NHS Digital Service Manual — Point 16', href: 'https://service-manual.nhs.uk/standards-and-technology/service-standard-points/16-make-your-service-clinically-safe' },
              { label: 'NHS Confederation AI Framework', href: 'https://www.nhsconfed.org/publications/nhs-communications-artificial-intelligence-operating-framework' },
              { label: 'ICO — Web Scraping & AI', href: 'https://ico.org.uk/media2/p3mkalna/our-response-to-uk-governments-consultation-on-copyright-and-artificial-intelligence.pdf' },
              { label: 'DSPT', href: 'https://digital.nhs.uk/services/data-security-and-protection-toolkit' },
              { label: 'AI & Digital Regulations Service', href: 'https://www.digitalregulations.innovation.nhs.uk/' },
            ].map(({ label, href }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 bg-white border border-blue-200 rounded-full px-3 py-1 hover:bg-blue-50 transition-colors font-medium"
              >
                {label}
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Analysis Cards ───────────────────────────────────────────────────────────

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 flex-shrink-0">
        {icon}
      </div>
      <h3 className="font-semibold text-gray-900">{title}</h3>
    </div>
  )
}

function RobotsTxtCard({ data }: { data: RobotsTxtAnalysis }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col">
      <SectionHeader
        title="robots.txt"
        icon={
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        }
      />
      <div className="flex flex-wrap gap-2 mb-3">
        <StatusBadge ok={data.exists} labelTrue="Found" labelFalse="Missing" />
        <ProtectionBadge level={data.aiProtection} />
        {data.allowsAIScraping ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> AI Scraping Permitted
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> AI Scraping Restricted
          </span>
        )}
      </div>
      <p className="text-sm text-gray-700 leading-relaxed mb-3">{data.summary}</p>
      {data.keyDirectives.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Key Directives</p>
          <ul className="space-y-1.5">
            {data.keyDirectives.map((d, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-gray-400 mt-0.5 flex-shrink-0">›</span>
                <code className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-800 break-all font-mono">{d}</code>
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
      <SectionHeader
        title="Structured Data Markup"
        icon={
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        }
      />
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
      <p className="text-sm text-gray-600 leading-relaxed italic mb-3 border-l-2 border-indigo-200 pl-3">{data.aiImpact}</p>
      <div className="mt-auto">
        <RecommendationBox text={data.recommendation} />
      </div>
    </div>
  )
}

function ClinicalCard({ data }: { data: ClinicalAnalysis }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col">
      <SectionHeader
        title="Clinical Information Review"
        icon={
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        }
      />
      <div className="flex flex-wrap gap-2 mb-3">
        <StatusBadge ok={data.hasClinicalContent} labelTrue="Clinical Content Found" labelFalse="No Clinical Content" />
        <RiskBadge level={data.misrepresentationRisk} label={`${data.misrepresentationRisk} misrepresentation risk`} />
      </div>
      {data.contentTypes.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Content Types Identified</p>
          <div className="flex flex-wrap gap-1.5">
            {data.contentTypes.map((t, i) => (
              <span key={i} className="text-xs px-2.5 py-0.5 bg-gray-100 text-gray-700 rounded-full border border-gray-200">{t}</span>
            ))}
          </div>
        </div>
      )}
      {data.misrepresentationConcerns.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Misrepresentation Concerns</p>
          <ul className="space-y-1.5">
            {data.misrepresentationConcerns.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-orange-500 flex-shrink-0 mt-0.5 text-base leading-none">⚠</span>
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
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0 mt-1.5" />
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
      <SectionHeader
        title="AI Scraping Profile"
        icon={
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        }
      />
      {data.whatAIWouldExtract.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">What AI Would Extract</p>
          <ul className="space-y-1.5">
            {data.whatAIWouldExtract.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0 mt-1.5" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mb-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">How It Would Be Used</p>
        <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-3 border border-gray-200">{data.howItWouldBeUsed}</p>
      </div>
      {data.potentialHarms.length > 0 && (
        <div className="mt-auto">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Potential Harms</p>
          <ul className="space-y-1.5">
            {data.potentialHarms.map((h, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-red-500 flex-shrink-0 mt-0.5 text-base leading-none">⚠</span>
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
    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
      <header style={{ backgroundColor: '#005EB8' }} className="w-full shadow-lg">
        <div className="max-w-5xl mx-auto px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                {/* NHS-style logo mark */}
                <div className="bg-white rounded px-2 py-0.5">
                  <span className="text-sm font-black text-blue-700 tracking-tight">NHS</span>
                </div>
                <h1 className="text-xl font-bold text-white leading-tight">BHFT Website AI Risk Checker</h1>
              </div>
              <p className="text-blue-200 text-sm">Berkshire Healthcare NHS Foundation Trust · Digital Governance</p>
            </div>
            <div className="hidden sm:flex flex-col items-end gap-1">
              <span className="text-xs text-blue-200">Powered by</span>
              <span className="text-xs font-semibold text-white bg-white/20 px-2 py-0.5 rounded">Claude AI</span>
            </div>
          </div>
        </div>
        {/* Accent bar */}
        <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #41B6E6 0%, #005EB8 50%, #003087 100%)' }} />
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Why This Matters */}
        <WhyThisMatters />

        {/* Analyser tool */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 pt-6 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#005EB8' }}>
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-gray-900">Analyse a Website</h2>
            </div>
            <p className="text-sm text-gray-500 ml-11">Enter any URL to see exactly what an AI scraping tool would extract, how it would use the content, and what governance risks exist.</p>
          </div>
          <div className="p-6">
            <div className="flex gap-3 flex-col sm:flex-row">
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAnalyse() }}
                placeholder="https://www.berkshirehealthcare.nhs.uk/"
                disabled={loading}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400 font-mono transition-shadow"
                style={{ '--tw-ring-color': '#005EB8' } as React.CSSProperties}
              />
              <button
                onClick={handleAnalyse}
                disabled={loading || !url.trim()}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-semibold transition-all disabled:cursor-not-allowed sm:w-auto w-full shadow-sm"
                style={{ backgroundColor: loading || !url.trim() ? '#94a3b8' : '#005EB8' }}
              >
                {loading ? (
                  <>
                    <Spinner />
                    Analysing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Analyse Website
                  </>
                )}
              </button>
            </div>

            {/* What we check */}
            {!loading && !result && !error && (
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'robots.txt', sub: 'AI crawler rules' },
                  { label: 'Structured Data', sub: 'Schema markup' },
                  { label: 'Clinical Risk', sub: 'Misrepresentation' },
                  { label: 'Scraping Profile', sub: 'What AI extracts' },
                ].map(({ label, sub }) => (
                  <div key={label} className="flex flex-col items-center text-center p-3 rounded-lg bg-gray-50 border border-gray-200">
                    <span className="text-xs font-semibold text-gray-700">{label}</span>
                    <span className="text-xs text-gray-400 mt-0.5">{sub}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-semibold text-red-800 text-sm mb-1">Analysis failed</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 flex flex-col items-center justify-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-blue-100 animate-pulse" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-gray-800 font-semibold">Analysing website...</p>
              <p className="text-gray-400 text-sm mt-1 max-w-sm">Fetching robots.txt, parsing structured data markup, extracting content, and running AI risk analysis. This takes 15–30 seconds.</p>
            </div>
            <div className="flex gap-6 mt-2">
              {['Fetching page', 'Parsing content', 'AI analysis'].map((step, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs text-gray-500">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
                  {step}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {result && !loading && risk && (
          <>
            {/* Overall Risk Score */}
            <div className={`rounded-2xl border bg-gradient-to-br p-6 sm:p-8 ${riskScoreBg(risk.score)}`}>
              <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                {/* Score */}
                <div className="flex-shrink-0 text-center">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">AI Risk Score</p>
                  <div className={`text-7xl font-black leading-none ${riskScoreColor(risk.score)}`}>
                    {risk.score}
                    <span className="text-2xl text-gray-400 font-normal">/10</span>
                  </div>
                  <div className="mt-3 flex justify-center">
                    <RiskBadge level={risk.level} label={`${risk.level} risk`} />
                  </div>
                </div>
                {/* Divider */}
                <div className="hidden sm:block w-px h-28 bg-gray-300" />
                {/* Summary */}
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Site Analysed</p>
                  <p className="font-semibold text-gray-900 mb-0.5 truncate">{result.title}</p>
                  <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm font-mono break-all">{result.url}</a>
                  <p className="text-sm text-gray-700 leading-relaxed mt-3 border-l-2 border-gray-400 pl-3">{risk.summary}</p>
                </div>
              </div>
            </div>

            {/* 4 Analysis Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <RobotsTxtCard data={result.analysis.robotsTxt} />
              <StructuredDataCard data={result.analysis.structuredData} />
              <ClinicalCard data={result.analysis.clinicalInformation} />
              <ScrapingProfileCard data={result.analysis.scrapingProfile} />
            </div>

            {/* Immediate Actions */}
            {risk.immediateActions.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-orange-200 overflow-hidden">
                <div className="px-6 py-4 bg-orange-50 border-b border-orange-200 flex items-center gap-2">
                  <span className="text-orange-600 text-lg">⚠</span>
                  <h3 className="font-bold text-gray-900">Immediate Actions Required</h3>
                </div>
                <div className="p-6">
                  <ol className="space-y-4 mb-6">
                    {risk.immediateActions.map((action, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span
                          className="flex-shrink-0 w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center shadow-sm"
                          style={{ backgroundColor: '#005EB8' }}
                        >
                          {i + 1}
                        </span>
                        <p className="text-sm text-gray-700 leading-relaxed pt-1">{action}</p>
                      </li>
                    ))}
                  </ol>
                  {risk.topConcerns.length > 0 && (
                    <div className="pt-5 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Top Concerns Identified</p>
                      <div className="space-y-2">
                        {risk.topConcerns.map((concern, i) => (
                          <div key={i} className="flex items-start gap-2.5 p-3 rounded-lg bg-gray-50 border border-gray-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0 mt-1.5" />
                            <p className="text-sm text-gray-700">{concern}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Analyse another */}
            <div className="text-center pb-4">
              <button
                onClick={() => { setResult(null); setError(null); setUrl('') }}
                className="text-sm text-gray-500 hover:text-gray-800 underline underline-offset-2 transition-colors"
              >
                Analyse another website
              </button>
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-8">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-700">BHFT Website AI Risk Checker</p>
              <p className="text-xs text-gray-400 mt-0.5">For internal digital governance use · Berkshire Healthcare NHS Foundation Trust</p>
            </div>
            <div className="flex items-center gap-4">
              <a href="https://transform.england.nhs.uk/information-governance/guidance/artificial-intelligence/" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">NHS AI IG Guidance</a>
              <a href="https://www.digitalregulations.innovation.nhs.uk/" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">AI & Digital Regulations</a>
              <span className="text-xs text-gray-400">Powered by Claude AI</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
