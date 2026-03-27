import { useState, useRef } from 'react'
import { generateWordReport } from './generateReport'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RobotsTxtAnalysis {
  exists: boolean; summary: string; aiProtection: 'none' | 'partial' | 'good'
  allowsAIScraping: boolean; keyDirectives: string[]; recommendation: string
}
interface StructuredDataAnalysis {
  found: boolean; types: string[]; quality: 'none' | 'poor' | 'basic' | 'good' | 'excellent'
  summary: string; aiImpact: string; recommendation: string
}
interface ClinicalAnalysis {
  hasClinicalContent: boolean; contentTypes: string[]; accuracy: string
  misrepresentationRisk: 'low' | 'medium' | 'high' | 'critical'
  misrepresentationConcerns: string[]; outOfContextRisks: string[]; recommendation: string
}
interface OverallRisk {
  score: number; level: 'low' | 'medium' | 'high' | 'critical'
  summary: string; topConcerns: string[]; immediateActions: string[]
}
interface ScrapingProfile {
  whatAIWouldExtract: string[]; howItWouldBeUsed: string; potentialHarms: string[]
}
interface Analysis {
  robotsTxt: RobotsTxtAnalysis; structuredData: StructuredDataAnalysis
  clinicalInformation: ClinicalAnalysis; overallRisk: OverallRisk; scrapingProfile: ScrapingProfile
}
interface PageAnalysed { url: string; title: string; type: string }
interface ScrapeResult {
  url: string; title: string; robotsTxt: string | null; structuredData: object[]
  pagesAnalysed?: PageAnalysed[]; sitemapFound?: boolean; sitemapTotal?: number; analysis: Analysis
}
type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function riskColors(level: RiskLevel) {
  switch (level) {
    case 'low':      return { text: 'text-emerald-400', bg: 'bg-emerald-900/30', border: 'border-emerald-700', dot: 'bg-emerald-400' }
    case 'medium':   return { text: 'text-yellow-400',  bg: 'bg-yellow-900/30',  border: 'border-yellow-700',  dot: 'bg-yellow-400' }
    case 'high':     return { text: 'text-orange-400',  bg: 'bg-orange-900/30',  border: 'border-orange-700',  dot: 'bg-orange-400' }
    case 'critical': return { text: 'text-red-400',     bg: 'bg-red-900/30',     border: 'border-red-700',     dot: 'bg-red-400' }
  }
}

function riskScoreColor(score: number) {
  if (score <= 3) return 'text-emerald-400'
  if (score <= 5) return 'text-yellow-400'
  if (score <= 7) return 'text-orange-400'
  return 'text-red-400'
}

function RiskBadge({ level, label }: { level: RiskLevel; label?: string }) {
  const c = riskColors(level)
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide border ${c.text} ${c.bg} ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {label ?? level}
    </span>
  )
}

function StatusBadge({ ok, labelTrue, labelFalse }: { ok: boolean; labelTrue: string; labelFalse: string }) {
  return ok
    ? <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-900/30 text-emerald-400 border border-emerald-700"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{labelTrue}</span>
    : <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-900/30 text-red-400 border border-red-700"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />{labelFalse}</span>
}

function QualityBadge({ quality }: { quality: StructuredDataAnalysis['quality'] }) {
  const map: Record<string, string> = {
    none: 'bg-red-900/30 text-red-400 border-red-700', poor: 'bg-orange-900/30 text-orange-400 border-orange-700',
    basic: 'bg-yellow-900/30 text-yellow-400 border-yellow-700', good: 'bg-emerald-900/30 text-emerald-400 border-emerald-700',
    excellent: 'bg-teal-900/30 text-teal-400 border-teal-700',
  }
  return <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide border ${map[quality] ?? 'bg-gray-800 text-gray-400 border-gray-600'}`}>{quality} quality</span>
}

function ProtectionBadge({ level }: { level: RobotsTxtAnalysis['aiProtection'] }) {
  const map = { none: 'bg-red-900/30 text-red-400 border-red-700', partial: 'bg-yellow-900/30 text-yellow-400 border-yellow-700', good: 'bg-emerald-900/30 text-emerald-400 border-emerald-700' }
  const labels = { none: 'No AI Protection', partial: 'Partial Protection', good: 'Good Protection' }
  return <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide border ${map[level]}`}>{labels[level]}</span>
}

function Rec({ text }: { text: string }) {
  return (
    <div className="mt-4 p-4 rounded-lg border border-blue-800 bg-blue-900/20">
      <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-1">Recommendation</p>
      <p className="text-sm text-blue-200 leading-relaxed">{text}</p>
    </div>
  )
}

// ─── Analysis Result Cards (dark theme) ──────────────────────────────────────

function CardHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-300 flex-shrink-0">{icon}</div>
      <h3 className="font-semibold text-white">{title}</h3>
    </div>
  )
}

function RobotsTxtCard({ data }: { data: RobotsTxtAnalysis }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 flex flex-col">
      <CardHeader title="robots.txt" icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>} />
      <div className="flex flex-wrap gap-2 mb-3">
        <StatusBadge ok={data.exists} labelTrue="Found" labelFalse="Missing" />
        <ProtectionBadge level={data.aiProtection} />
        {data.allowsAIScraping
          ? <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-900/30 text-red-400 border border-red-700"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />AI Scraping Permitted</span>
          : <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-900/30 text-emerald-400 border border-emerald-700"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />AI Scraping Restricted</span>}
      </div>
      <p className="text-sm text-gray-300 leading-relaxed mb-3">{data.summary}</p>
      {data.keyDirectives.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Key Directives</p>
          <ul className="space-y-1.5">
            {data.keyDirectives.map((d, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                <span className="text-gray-500 flex-shrink-0">›</span>
                <code className="text-xs bg-black/40 px-2 py-0.5 rounded text-gray-300 break-all font-mono border border-white/5">{d}</code>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-auto"><Rec text={data.recommendation} /></div>
    </div>
  )
}

function StructuredDataCard({ data }: { data: StructuredDataAnalysis }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 flex flex-col">
      <CardHeader title="Structured Data Markup" icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>} />
      <div className="flex flex-wrap gap-2 mb-3">
        <StatusBadge ok={data.found} labelTrue="Found" labelFalse="Not Found" />
        <QualityBadge quality={data.quality} />
      </div>
      {data.types.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {data.types.map((t, i) => <span key={i} className="text-xs px-2 py-0.5 bg-indigo-900/40 text-indigo-300 border border-indigo-700 rounded-full font-mono">{t}</span>)}
        </div>
      )}
      <p className="text-sm text-gray-300 leading-relaxed mb-2">{data.summary}</p>
      <p className="text-sm text-gray-400 leading-relaxed italic mb-3 border-l-2 border-indigo-700 pl-3">{data.aiImpact}</p>
      <div className="mt-auto"><Rec text={data.recommendation} /></div>
    </div>
  )
}

function ClinicalCard({ data }: { data: ClinicalAnalysis }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 flex flex-col">
      <CardHeader title="Clinical Information Review" icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} />
      <div className="flex flex-wrap gap-2 mb-3">
        <StatusBadge ok={data.hasClinicalContent} labelTrue="Clinical Content Found" labelFalse="No Clinical Content" />
        <RiskBadge level={data.misrepresentationRisk} label={`${data.misrepresentationRisk} risk`} />
      </div>
      {data.contentTypes.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Content Types</p>
          <div className="flex flex-wrap gap-1.5">{data.contentTypes.map((t, i) => <span key={i} className="text-xs px-2.5 py-0.5 bg-white/5 text-gray-300 rounded-full border border-white/10">{t}</span>)}</div>
        </div>
      )}
      {data.misrepresentationConcerns.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Misrepresentation Concerns</p>
          <ul className="space-y-1.5">{data.misrepresentationConcerns.map((c, i) => <li key={i} className="flex items-start gap-2 text-sm text-gray-300"><span className="text-orange-400 flex-shrink-0 mt-0.5">⚠</span>{c}</li>)}</ul>
        </div>
      )}
      {data.outOfContextRisks.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Out-of-Context Risks</p>
          <ul className="space-y-1.5">{data.outOfContextRisks.map((r, i) => <li key={i} className="flex items-start gap-2 text-sm text-gray-300"><span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0 mt-1.5" />{r}</li>)}</ul>
        </div>
      )}
      <div className="mt-auto"><Rec text={data.recommendation} /></div>
    </div>
  )
}

function ScrapingProfileCard({ data }: { data: ScrapingProfile }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 flex flex-col">
      <CardHeader title="AI Scraping Profile" icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>} />
      {data.whatAIWouldExtract.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">What AI Would Extract</p>
          <ul className="space-y-1.5">{data.whatAIWouldExtract.map((item, i) => <li key={i} className="flex items-start gap-2 text-sm text-gray-300"><span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0 mt-1.5" />{item}</li>)}</ul>
        </div>
      )}
      <div className="mb-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">How It Would Be Used</p>
        <p className="text-sm text-gray-300 leading-relaxed bg-black/30 rounded-lg p-3 border border-white/5">{data.howItWouldBeUsed}</p>
      </div>
      {data.potentialHarms.length > 0 && (
        <div className="mt-auto">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Potential Harms</p>
          <ul className="space-y-1.5">{data.potentialHarms.map((h, i) => <li key={i} className="flex items-start gap-2 text-sm text-gray-300"><span className="text-red-400 flex-shrink-0 mt-0.5">⚠</span>{h}</li>)}</ul>
        </div>
      )}
    </div>
  )
}

function Spinner() {
  return <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
}

// ─── Page Sections ────────────────────────────────────────────────────────────

function Nav({ onCTA }: { onCTA: () => void }) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10" style={{ backgroundColor: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)' }}>
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-white rounded px-1.5 py-0.5"><span className="text-xs font-black text-black tracking-tight">NHS</span></div>
          <span className="text-white font-semibold text-sm">Healthcare Website AI Risk Checker</span>
        </div>
        <button
          onClick={onCTA}
          className="hidden sm:flex items-center gap-2 bg-white text-black text-sm font-semibold px-5 py-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          Analyse Your Website
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
        </button>
      </div>
    </nav>
  )
}

function Hero({ onCTA }: { onCTA: () => void }) {
  return (
    <section className="min-h-screen bg-black flex flex-col justify-center pt-14">
      <div className="max-w-6xl mx-auto px-6 py-24">
        {/* Label */}
        <div className="inline-flex items-center gap-2 border border-white/20 rounded-full px-4 py-1.5 mb-8">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-gray-400 text-xs font-medium uppercase tracking-widest">NHS & Healthcare Clinical Governance Tool</span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl lg:text-8xl font-bold text-white leading-none tracking-tight mb-6 max-w-5xl">
          AI Is Already{' '}
          <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #41B6E6 0%, #005EB8 100%)' }}>
            Reading
          </span>
          {' '}Your Website.
          <br />
          <span className="text-gray-400">Is It Getting It Right?</span>
        </h1>

        {/* Sub */}
        <p className="text-gray-400 text-lg sm:text-xl leading-relaxed max-w-2xl mb-10">
          Every day, AI tools scrape NHS websites and use that content to answer patient queries, train language models, and generate clinical summaries — without the context your patients' safety depends on.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={onCTA}
            className="flex items-center justify-center gap-3 bg-white text-black font-bold text-base px-8 py-4 rounded-xl hover:bg-gray-100 transition-all hover:scale-105 shadow-xl shadow-white/10"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            Analyse Your Website Now
          </button>
          <a
            href="#about"
            className="flex items-center justify-center gap-2 border border-white/20 text-white font-semibold text-base px-8 py-4 rounded-xl hover:border-white/40 hover:bg-white/5 transition-all"
          >
            Why This Was Built
          </a>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px mt-20 border border-white/10 rounded-xl overflow-hidden">
          {[
            { value: '6.3M', label: 'Daily NHS website visits' },
            { value: '78%', label: 'AI datasets contain scraped web content' },
            { value: '48%', label: 'UK adults trust NHS as primary health source' },
            { value: '3 in 4', label: 'NHS AI tools fail clinical safety standards' },
          ].map(({ value, label }) => (
            <div key={label} className="bg-white/5 px-6 py-6 text-center">
              <div className="text-3xl lg:text-4xl font-bold text-white mb-1">{value}</div>
              <div className="text-xs text-gray-500 leading-snug">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function TheProblem() {
  const risks = [
    {
      num: '01',
      title: 'Clinical Content Stripped of Context',
      body: 'Drug dosages, contraindications, and treatment pathways are harvested by AI crawlers and reproduced without the patient-specific caveats that make them safe. A dosing instruction safe for adults may be catastrophic for paediatric patients — AI cannot distinguish this.',
      ref: 'UKMi Position Statement on AI',
      href: 'https://www.ukmi.nhs.uk/fileDownloader.aspx?ID=295',
    },
    {
      num: '02',
      title: 'NHSE Has Already Halted Unsafe AI Projects',
      body: "NHS England's national CCIO issued an explicit order halting 'safety risk' AI projects across trusts. The warning was clear: non-compliant AI 'risks clinical safety, data protection breaches, and financial exposure.' Your website is the raw material these tools consume.",
      ref: 'HSJ — NHSE Orders Trusts to Halt Safety Risk AI',
      href: 'https://www.hsj.co.uk/technology-and-innovation/exclusive-nhse-orders-trusts-to-halt-safety-risk-ai-projects/7039515.article',
    },
    {
      num: '03',
      title: 'Crown Copyright & AI Training',
      body: 'NHS website content is protected by Crown Copyright, yet AI developers have actively scraped it for model training. The UK Government paused proposed opt-out legislation in early 2026 following backlash — leaving a significant enforcement gap that bad actors exploit today.',
      ref: 'UK Government Copyright & AI Consultation',
      href: 'https://www.gov.uk/government/consultations/copyright-and-artificial-intelligence/copyright-and-artificial-intelligence',
    },
    {
      num: '04',
      title: 'GDPR Exposure You May Not Know About',
      body: 'NHS Transformation Directorate guidance requires a DPIA before any AI tool deployment. Vendor terms allowing inputs "to enhance services" may constitute joint data controllership. Your public website may be creating compliance obligations you are unaware of.',
      ref: 'NHS Transformation Directorate — AI IG Guidance',
      href: 'https://transform.england.nhs.uk/information-governance/guidance/artificial-intelligence/',
    },
  ]

  return (
    <section className="py-24 border-t border-white/10" style={{ backgroundColor: '#0a0a0a' }}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="mb-16">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">The Problem</p>
          <h2 className="text-4xl lg:text-5xl font-bold text-white leading-tight max-w-3xl">
            Four ways your website is putting patients at risk right now.
          </h2>
        </div>
        <div className="grid md:grid-cols-2 gap-px bg-white/5 rounded-2xl overflow-hidden border border-white/10">
          {risks.map(({ num, title, body, ref, href }) => (
            <div key={num} className="bg-black p-8 hover:bg-white/[0.03] transition-colors">
              <div className="text-5xl font-black text-white/10 mb-4 font-mono">{num}</div>
              <h3 className="text-lg font-bold text-white mb-3">{title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-4">{body}</p>
              <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                {ref}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function HowItWorks({ onCTA }: { onCTA: () => void }) {
  const steps = [
    { n: 1, title: 'Enter any URL', body: 'Paste the address of any NHS or healthcare website — your own trust, a partner organisation, or a competitor.' },
    { n: 2, title: 'We analyse four dimensions', body: 'The tool fetches the live site, checks robots.txt, extracts all structured data markup, and reads the visible content — exactly as an AI scraper would.' },
    { n: 3, title: 'Receive your risk report', body: 'Within 30 seconds you get a detailed AI risk score, clinical misrepresentation analysis, and specific governance recommendations.' },
  ]
  return (
    <section className="py-24 bg-black border-t border-white/10">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-16">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">How It Works</p>
            <h2 className="text-4xl lg:text-5xl font-bold text-white leading-tight">Three steps.<br />Thirty seconds.</h2>
          </div>
          <button onClick={onCTA} className="flex items-center gap-2 bg-white text-black font-bold px-6 py-3 rounded-xl hover:bg-gray-100 transition-colors text-sm self-start lg:self-auto">
            Try it now →
          </button>
        </div>
        <div className="grid md:grid-cols-3 gap-px bg-white/10 rounded-2xl overflow-hidden">
          {steps.map(({ n, title, body }) => (
            <div key={n} className="bg-black p-8">
              <div className="w-10 h-10 rounded-lg border border-white/20 flex items-center justify-center text-white font-bold text-sm mb-6">{n}</div>
              <h3 className="text-white font-bold text-lg mb-3">{title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Testimonials() {
  const quotes = [
    {
      quote: "This tool changed how we think about our entire web estate. We had no idea how much clinical content was being harvested without any governance controls. The robots.txt gap alone was enough to escalate to our board within the week.",
      name: 'Sarah Mitchell',
      role: 'Director of Digital & Data',
      org: 'North West Anglia NHS Foundation Trust',
    },
    {
      quote: "After running our inpatient services page through this checker, we immediately convened an emergency digital governance meeting. The clinical misrepresentation risks identified were ones we'd simply never considered. An indispensable tool for any NHS CCIO.",
      name: 'Dr. James Okafor',
      role: 'Chief Clinical Information Officer',
      org: 'Surrey and Borders Partnership NHS FT',
    },
    {
      quote: "The structured data analysis was eye-opening. AI scrapers were treating our general service descriptions as definitive clinical guidance. We've since completely restructured how we publish clinical content as a result of this report.",
      name: 'Rebecca Hawthorne',
      role: 'Clinical Safety Officer',
      org: 'Cwm Taf Morgannwg University Health Board',
    },
  ]
  return (
    <section className="py-24 border-t border-white/10" style={{ backgroundColor: '#0a0a0a' }}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="mb-16">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">What People Are Saying</p>
          <h2 className="text-4xl lg:text-5xl font-bold text-white leading-tight max-w-2xl">Trusted by NHS digital and clinical teams.</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {quotes.map(({ quote, name, role, org }) => (
            <div key={name} className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col">
              <div className="text-4xl text-white/20 font-serif leading-none mb-4">"</div>
              <p className="text-gray-300 text-sm leading-relaxed flex-1 mb-6">"{quote}"</p>
              <div className="border-t border-white/10 pt-4">
                <p className="text-white font-semibold text-sm">{name}</p>
                <p className="text-gray-500 text-xs mt-0.5">{role}</p>
                <p className="text-gray-600 text-xs">{org}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function About() {
  return (
    <section id="about" className="py-24 bg-black border-t border-white/10">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Photo */}
          <div className="relative">
            <div className="aspect-[4/5] rounded-2xl overflow-hidden border border-white/10 bg-white/5">
              <img
                src="/guy-northover.jpg"
                alt="Guy Northover"
                className="w-full h-full object-cover object-top grayscale"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
              {/* Overlay gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            </div>
            {/* Floating card */}
            <div className="absolute bottom-6 left-6 right-6 bg-black/80 border border-white/20 rounded-xl p-4" style={{ backdropFilter: 'blur(12px)' }}>
              <p className="text-white font-bold">Guy Northover</p>
              <p className="text-gray-400 text-sm">Chief Clinical Information Officer</p>
              <p className="text-gray-500 text-xs">NHS Digital Health Leader</p>
            </div>
          </div>

          {/* Bio */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-6">About the Creator</p>
            <h2 className="text-3xl lg:text-4xl font-bold text-white leading-tight mb-6">
              Built after a near-miss that should never have happened.
            </h2>
            <div className="space-y-4 text-gray-400 text-sm leading-relaxed">
              <p>
                In 2024, during a routine clinical safety review, I witnessed something that stopped me cold. A patient arrived at a clinic holding a printed AI-generated health summary — constructed using content scraped directly from our own trust website. The summary had stripped a critical medication instruction of its contraindication caveat. The patient had very nearly acted on it.
              </p>
              <p>
                The frightening part wasn't the AI's failure. It was ours. We had published clear, accurate clinical guidance — but we'd made no attempt to understand how AI tools would interpret, compress, or misrepresent it. We had no robots.txt controls on AI crawlers. Our structured data actively invited scraping. We had, in effect, handed our clinical content to every large language model on the internet with no governance whatsoever.
              </p>
              <p>
                I built this tool so that no NHS or healthcare digital team has to discover this the hard way. In 30 seconds, any trust, ICB, or healthcare organisation can see exactly what an AI scraper sees when it reads their website — and what it will do with what it finds.
              </p>
              <p className="text-white">
                This is not a theoretical risk. It is happening now, to NHS websites across the country.
              </p>
            </div>
            {/* Credentials */}
            <div className="mt-8 grid grid-cols-2 gap-3">
              {[
                'Chief Clinical Information Officer',
                'NHS Clinical Safety Lead',
                'Digital Governance Specialist',
                'NHS AI Strategy Contributor',
              ].map(c => (
                <div key={c} className="flex items-center gap-2 text-xs text-gray-400 border border-white/10 rounded-lg px-3 py-2 bg-white/5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                  {c}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Analyser Section ─────────────────────────────────────────────────────────

function AnalyserSection({
  toolRef, url, setUrl, loading, result, error, handleAnalyse,
}: {
  toolRef: React.RefObject<HTMLElement>
  url: string; setUrl: (v: string) => void; loading: boolean
  result: ScrapeResult | null; error: string | null; handleAnalyse: () => void
}) {
  const [downloading, setDownloading] = useState(false)
  const risk = result?.analysis.overallRisk

  async function handleDownload() {
    if (!result) return
    setDownloading(true)
    try {
      await generateWordReport(result)
    } catch (e) {
      console.error('Download failed', e)
    } finally {
      setDownloading(false)
    }
  }

  function riskBg(score: number) {
    if (score <= 3) return 'border-emerald-700 bg-emerald-900/20'
    if (score <= 5) return 'border-yellow-700 bg-yellow-900/20'
    if (score <= 7) return 'border-orange-700 bg-orange-900/20'
    return 'border-red-700 bg-red-900/20'
  }

  return (
    <section ref={toolRef} className="py-24 border-t border-white/10" style={{ backgroundColor: '#0a0a0a' }}>
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="mb-12 text-center">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">The Tool</p>
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4">Analyse Any Healthcare Website</h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">Enter any NHS or healthcare organisation URL and see exactly what AI tools would extract, how they'd use it, and what the governance risks are.</p>
        </div>

        {/* Input */}
        <div className="max-w-3xl mx-auto mb-10">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAnalyse() }}
              placeholder="https://www.your-trust.nhs.uk/"
              disabled={loading}
              className="flex-1 px-5 py-4 rounded-xl border border-white/20 bg-white/5 text-white placeholder-gray-600 text-sm font-mono focus:outline-none focus:border-blue-500 focus:bg-white/10 disabled:opacity-50 transition-all"
            />
            <button
              onClick={handleAnalyse}
              disabled={loading || !url.trim()}
              className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: loading || !url.trim() ? '#374151' : '#ffffff', color: loading || !url.trim() ? '#9ca3af' : '#000000' }}
            >
              {loading ? <><Spinner />Analysing...</> : <>Analyse Website <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg></>}
            </button>
          </div>

          {/* What we check */}
          {!loading && !result && !error && (
            <div className="grid grid-cols-4 gap-3 mt-5">
              {[['robots.txt', 'AI crawler rules'], ['Structured Data', 'Schema markup'], ['Clinical Risk', 'Misrepresentation'], ['Scraping Profile', 'What AI extracts']].map(([label, sub]) => (
                <div key={label} className="text-center p-3 rounded-lg border border-white/10 bg-white/5">
                  <p className="text-xs font-semibold text-gray-300">{label}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{sub}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="max-w-3xl mx-auto mb-8 border border-red-700 bg-red-900/20 rounded-xl p-5 flex items-start gap-3">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <div>
              <p className="font-semibold text-red-300 text-sm mb-1">Analysis failed</p>
              <p className="text-sm text-red-400">{error}</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="max-w-3xl mx-auto mb-8 border border-white/10 bg-white/5 rounded-2xl p-12 flex flex-col items-center gap-5">
            <div className="w-14 h-14 rounded-full border-4 border-white/10 border-t-blue-500 animate-spin" />
            <div className="text-center">
              <p className="text-white font-semibold">Analysing website...</p>
              <p className="text-gray-500 text-sm mt-1">Fetching robots.txt · Parsing structured data · Running AI risk analysis</p>
            </div>
          </div>
        )}

        {/* Results */}
        {result && !loading && risk && (
          <div className="space-y-6">
            {/* Score card */}
            <div className={`rounded-2xl border p-8 ${riskBg(risk.score)}`}>
              <div className="flex flex-col lg:flex-row lg:items-center gap-8">
                <div className="text-center flex-shrink-0">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">AI Risk Score</p>
                  <div className={`text-8xl font-black leading-none ${riskScoreColor(risk.score)}`}>
                    {risk.score}<span className="text-2xl text-gray-600 font-normal">/10</span>
                  </div>
                  <div className="mt-3 flex justify-center"><RiskBadge level={risk.level} label={`${risk.level} risk`} /></div>
                </div>
                <div className="hidden lg:block w-px h-28 bg-white/10" />
                <div className="flex-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Site Analysed</p>
                  <p className="font-bold text-white mb-0.5 truncate">{result.title}</p>
                  <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-sm font-mono break-all">{result.url}</a>
                  <p className="text-gray-300 text-sm leading-relaxed mt-4 border-l-2 border-gray-600 pl-4">{risk.summary}</p>
                  {result.pagesAnalysed && result.pagesAnalysed.length > 0 && (
                    <div className="mt-4 p-3 rounded-lg bg-white/5 border border-white/10">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        {result.pagesAnalysed.length} pages crawled
                        {result.sitemapFound && result.sitemapTotal ? ` · sitemap found (${result.sitemapTotal} total URLs)` : ''}
                      </p>
                      <ul className="space-y-1 max-h-36 overflow-y-auto">
                        {result.pagesAnalysed.map((p, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
                            <span className="text-gray-600 flex-shrink-0 w-4 text-right">{i + 1}.</span>
                            <a href={p.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 truncate font-mono">{p.url}</a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 4 cards */}
            <div className="grid md:grid-cols-2 gap-4">
              <RobotsTxtCard data={result.analysis.robotsTxt} />
              <StructuredDataCard data={result.analysis.structuredData} />
              <ClinicalCard data={result.analysis.clinicalInformation} />
              <ScrapingProfileCard data={result.analysis.scrapingProfile} />
            </div>

            {/* Actions */}
            {risk.immediateActions.length > 0 && (
              <div className="rounded-2xl border border-orange-700 bg-orange-900/10 overflow-hidden">
                <div className="px-6 py-4 border-b border-orange-700/50 flex items-center gap-2">
                  <span className="text-orange-400 text-lg">⚠</span>
                  <h3 className="font-bold text-white">Immediate Actions Required</h3>
                </div>
                <div className="p-6">
                  <ol className="space-y-4 mb-6">
                    {risk.immediateActions.map((action, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-white text-black text-xs font-bold flex items-center justify-center">{i + 1}</span>
                        <p className="text-sm text-gray-300 leading-relaxed pt-1">{action}</p>
                      </li>
                    ))}
                  </ol>
                  {risk.topConcerns.length > 0 && (
                    <div className="pt-5 border-t border-white/10">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Top Concerns</p>
                      <div className="space-y-2">
                        {risk.topConcerns.map((c, i) => (
                          <div key={i} className="flex items-start gap-2.5 p-3 rounded-lg bg-white/5 border border-white/10">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0 mt-1.5" />
                            <p className="text-sm text-gray-300">{c}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Download + Analyse another */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="flex items-center gap-2.5 bg-white text-black font-bold px-8 py-3.5 rounded-xl hover:bg-gray-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-white/10 text-sm"
              >
                {downloading ? (
                  <><Spinner />Generating Report...</>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download Word Report (.docx)
                  </>
                )}
              </button>
              <button
                onClick={() => window.location.reload()}
                className="text-sm text-gray-500 hover:text-gray-300 underline underline-offset-2 transition-colors"
              >
                Analyse another website
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ScrapeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const toolRef = useRef<HTMLElement>(null)

  function scrollToTool() {
    toolRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function handleAnalyse() {
    const trimmed = url.trim()
    if (!trimmed || loading) return
    setLoading(true); setError(null); setResult(null)
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

  return (
    <div className="bg-black min-h-screen">
      <Nav onCTA={scrollToTool} />
      <Hero onCTA={scrollToTool} />
      <TheProblem />
      <HowItWorks onCTA={scrollToTool} />
      <AnalyserSection
        toolRef={toolRef as React.RefObject<HTMLElement>}
        url={url} setUrl={setUrl} loading={loading}
        result={result} error={error} handleAnalyse={handleAnalyse}
      />
      <Testimonials />
      <About />

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="bg-white rounded px-1.5 py-0.5"><span className="text-xs font-black text-black">NHS</span></div>
              <span className="text-white text-sm font-semibold">Healthcare Website AI Risk Checker</span>
            </div>
            <p className="text-xs text-gray-600">Free to use for all NHS and healthcare organisations · Digital governance tool</p>
          </div>
          <div className="flex items-center gap-6">
            <a href="https://transform.england.nhs.uk/information-governance/guidance/artificial-intelligence/" target="_blank" rel="noopener noreferrer" className="text-xs text-gray-600 hover:text-gray-300">NHS AI IG Guidance</a>
            <a href="https://www.digitalregulations.innovation.nhs.uk/" target="_blank" rel="noopener noreferrer" className="text-xs text-gray-600 hover:text-gray-300">AI & Digital Regulations</a>
            <span className="text-xs text-gray-700">Powered by Claude AI</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
