import { useState } from 'react'
import { useTier } from './TierContext'

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

function Spinner() {
  return <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
}

interface PricingCardProps {
  tierNum: number
  title: string
  badge?: string
  badgeClass?: string
  price: string
  priceNote?: string
  description: string
  features: string[]
  buttonLabel: string
  activeButtonLabel: string
  borderClass: string
  bgClass: string
  currentTier: number
  loading: boolean
  onPurchase: (tier: number) => void
  onNavigate?: () => void
}

function PricingCard({
  tierNum, title, badge, badgeClass, price, priceNote, description, features,
  buttonLabel, activeButtonLabel, borderClass, bgClass, currentTier, loading, onPurchase, onNavigate,
}: PricingCardProps) {
  const isActive = currentTier >= tierNum
  const isFree = tierNum === 1

  return (
    <div className={`relative rounded-2xl border ${isActive ? 'border-emerald-500' : borderClass} ${bgClass} p-8 flex flex-col transition-all`}>
      {/* Active badge */}
      {isActive && !isFree && (
        <div className="absolute -top-3 left-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500 text-black uppercase tracking-wide">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Active
          </span>
        </div>
      )}

      {/* Tier badge (Most Popular / Enterprise) */}
      {badge && !isActive && (
        <div className="absolute -top-3 left-6">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${badgeClass}`}>
            {badge}
          </span>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-xl font-bold text-white">{title}</h3>
          {isFree && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-900/40 text-emerald-400 border border-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Always Free
            </span>
          )}
        </div>
        <div className="mb-3">
          <span className="text-4xl font-black text-white">{price}</span>
          {priceNote && <span className="text-gray-400 text-sm ml-2">{priceNote}</span>}
        </div>
        <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
      </div>

      {/* Divider */}
      <div className="border-t border-white/10 mb-6" />

      {/* Features */}
      <ul className="space-y-3 flex-1 mb-8">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <CheckIcon />
            <span className="text-sm text-gray-300">{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA Button */}
      {isFree ? (
        <button
          onClick={onNavigate}
          className="w-full py-3.5 rounded-xl font-bold text-sm transition-all bg-white text-black hover:bg-gray-100 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-white/10"
        >
          {buttonLabel}
        </button>
      ) : isActive ? (
        <button
          onClick={onNavigate}
          className="w-full py-3.5 rounded-xl font-bold text-sm transition-all bg-emerald-500 text-black hover:bg-emerald-400 hover:scale-[1.02] active:scale-[0.98]"
        >
          {activeButtonLabel}
        </button>
      ) : (
        <button
          onClick={() => onPurchase(tierNum)}
          disabled={loading}
          className="w-full py-3.5 rounded-xl font-bold text-sm transition-all bg-white text-black hover:bg-gray-100 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 shadow-lg shadow-white/10 flex items-center justify-center gap-2"
        >
          {loading ? <><Spinner />{tierNum === 2 ? 'Processing...' : 'Processing...'}</> : buttonLabel}
        </button>
      )}
    </div>
  )
}

interface PricingPageProps {
  onGoToSingle: () => void
  onGoToFull: () => void
}

export default function PricingPage({ onGoToSingle, onGoToFull }: PricingPageProps) {
  const { tier, setTier, isTestMode, clearTier } = useTier()
  const [loadingTier, setLoadingTier] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handlePurchase(tierNum: number) {
    setLoadingTier(tierNum)
    setError(null)
    try {
      const res = await fetch(`/api/checkout/create?tier=${tierNum}`)
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Failed to create checkout session')

      if (data.mode === 'test') {
        // Test bypass — activate immediately
        setTier(data.tier, data.token)
      } else if (data.mode === 'stripe' && data.url) {
        // Redirect to Stripe checkout
        window.location.href = data.url
      } else {
        throw new Error('Unexpected response from checkout API')
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'An error occurred')
    } finally {
      setLoadingTier(null)
    }
  }

  async function handleTestBypass(tierNum: number) {
    setLoadingTier(tierNum * 10) // Distinct loading state for test buttons
    setError(null)
    try {
      const res = await fetch(`/api/checkout/create?tier=${tierNum}&test=true`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Test bypass failed')
      if (data.token) {
        setTier(data.tier, data.token)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'An error occurred')
    } finally {
      setLoadingTier(null)
    }
  }

  const tier2Features = [
    'Everything in Quick Scan',
    'Full site crawl (unlimited pages)',
    'Sitemap discovery & validation',
    'Clinical page identification across all pages',
    'Priority risk ranking by severity',
    'Comprehensive downloadable Word report',
  ]

  const tier3Features = [
    'Everything in Full Site Analysis',
    'AI rewrite of all clinical pages',
    'NHS Digital Service Manual compliance',
    'Plain English rewriting (grade 8 or below)',
    'Structured data markup generated per page',
    'robots.txt file generated with AI protections',
    'Before/after Word document per page',
  ]

  const tier1Features = [
    'Single page analysis',
    'robots.txt check',
    'Structured data review',
    'Clinical risk score',
    'Downloadable Word report',
  ]

  return (
    <div className="bg-black min-h-screen">
      {/* Test Mode Banner */}
      {isTestMode && (
        <div className="bg-amber-500/20 border-b border-amber-500/40 px-6 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 text-sm">⚠</span>
              <p className="text-amber-300 text-sm font-semibold">
                Test Mode Active — Tier {tier} unlocked for testing. No payment was taken.
              </p>
            </div>
            <button
              onClick={clearTier}
              className="text-xs text-amber-400 hover:text-amber-200 underline underline-offset-2 transition-colors flex-shrink-0"
            >
              Clear test access
            </button>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">Pricing</p>
          <h1 className="text-4xl lg:text-5xl font-black text-white leading-tight mb-5">
            Protect Every Patient.<br />
            <span className="text-gray-400">Choose Your Level.</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
            From instant single-page risk assessment to complete site-wide clinical safety compliance and NHS-standard content rewriting.
          </p>

          {/* Current tier indicator */}
          {tier > 1 && (
            <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-emerald-700 bg-emerald-900/20 text-emerald-400 text-sm font-semibold">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Currently active: Tier {tier} — {tier === 2 ? 'Full Site Analysis' : 'Full Analysis & Repair'}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-8 border border-red-700 bg-red-900/20 rounded-xl p-4 flex items-start gap-3 max-w-2xl mx-auto">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-semibold text-red-300 text-sm mb-0.5">Payment error</p>
              <p className="text-sm text-red-400">{error}</p>
            </div>
          </div>
        )}

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <PricingCard
            tierNum={1}
            title="Quick Scan"
            price="Free"
            description="Instant AI risk assessment of any single page or up to 10 pages"
            features={tier1Features}
            buttonLabel="Start Free Scan"
            activeButtonLabel="Start Free Scan"
            borderClass="border-white/10"
            bgClass="bg-white/5"
            currentTier={tier}
            loading={loadingTier === 1}
            onPurchase={handlePurchase}
            onNavigate={onGoToSingle}
          />

          <PricingCard
            tierNum={2}
            title="Full Site Analysis"
            badge="Most Popular"
            badgeClass="bg-blue-600 text-white"
            price="£150"
            priceNote="+ VAT"
            description="Complete crawl of your entire website with clinical risk analysis on every page"
            features={tier2Features}
            buttonLabel="Purchase — £150"
            activeButtonLabel="Access Full Analysis"
            borderClass="border-blue-500"
            bgClass="bg-blue-900/20"
            currentTier={tier}
            loading={loadingTier === 2}
            onPurchase={handlePurchase}
            onNavigate={onGoToFull}
          />

          <PricingCard
            tierNum={3}
            title="Full Analysis & Repair"
            badge="Enterprise"
            badgeClass="bg-amber-500 text-black"
            price="£1,000"
            priceNote="+ VAT"
            description="Everything in Full Analysis plus AI-powered rewriting of all clinical pages to NHS standards"
            features={tier3Features}
            buttonLabel="Purchase — £1,000"
            activeButtonLabel="Access Full Repair"
            borderClass="border-amber-500"
            bgClass="bg-amber-900/10"
            currentTier={tier}
            loading={loadingTier === 3}
            onPurchase={handlePurchase}
            onNavigate={onGoToFull}
          />
        </div>

        {/* Trust signals */}
        <div className="border-t border-white/10 pt-10 mb-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            {[
              { label: 'NHS Standards', sub: 'DCB0129 compliant' },
              { label: 'Secure Payment', sub: 'Powered by Stripe' },
              { label: 'No Subscription', sub: 'One-time payment' },
              { label: 'Instant Access', sub: 'After payment' },
            ].map(({ label, sub }) => (
              <div key={label} className="p-4 rounded-xl border border-white/10 bg-white/5">
                <p className="text-white font-semibold text-sm mb-1">{label}</p>
                <p className="text-gray-500 text-xs">{sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Test Mode Section */}
        <div className="border border-white/5 bg-white/[0.02] rounded-2xl p-8">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest mb-2">For Developers & Testing</p>
          <p className="text-gray-500 text-sm mb-5">
            Testing without payment integration? Unlock tier access instantly for development and demonstration purposes.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => handleTestBypass(2)}
              disabled={loadingTier === 20}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/10 bg-white/5 text-gray-400 hover:text-gray-200 hover:border-white/20 hover:bg-white/10 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingTier === 20 ? <Spinner /> : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              )}
              Unlock Tier 2 (Test)
            </button>
            <button
              onClick={() => handleTestBypass(3)}
              disabled={loadingTier === 30}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/10 bg-white/5 text-gray-400 hover:text-gray-200 hover:border-white/20 hover:bg-white/10 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingTier === 30 ? <Spinner /> : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              )}
              Unlock Tier 3 (Test)
            </button>
            {tier > 1 && (
              <button
                onClick={clearTier}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-red-900/50 bg-red-900/10 text-red-500 hover:text-red-300 hover:border-red-700 transition-all text-sm font-medium"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Reset to Tier 1
              </button>
            )}
          </div>
          <p className="text-gray-700 text-xs mt-4">
            Test tokens are prefixed with <code className="font-mono">test_</code> and verified server-side. No charges are made.
          </p>
        </div>
      </div>
    </div>
  )
}
