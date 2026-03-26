import { useState } from 'react';
import {
  Globe, Search, Shield, ShieldOff, ShieldAlert, ShieldCheck,
  Code2, FileText, Bot, CheckCircle2, XCircle, AlertTriangle,
  Loader2, Info,
} from 'lucide-react';
import {
  Button, Input, Card, CardHeader, CardBody, Badge, Alert,
  Tabs, CodeBlock, RiskPill,
} from './components/ui';

// ─── Types ───────────────────────────────────────────────────────────────────

type CrawlerResult = {
  agent: string; owner: string; status: string;
  blocked: boolean; partial?: boolean; details: string;
  crawlDelay?: string | null; usedWildcard?: boolean;
};

type ScrapeResult = {
  url: string;
  fetchedAt: string;
  durationMs: number;
  robotsTxt: {
    found: boolean; raw: string | null;
    parsed: {
      overallRating: string; overallSummary: string;
      crawlerAnalysis: CrawlerResult[];
      sitemaps: string[];
    } | null;
  };
  structuredData: {
    jsonLd: object[];
    openGraph: Record<string, string>;
    twitterCard: Record<string, string>;
    metaTags: Record<string, string | null>;
    microdata: Array<{ type: string; props: Record<string, string> }>;
    schemaAssessment: {
      hasHealthSchema: boolean; hasMedicalPublisherInfo: boolean;
      hasDateInfo: boolean; score: number; gaps: string[];
    };
  };
  scrapedContent: {
    title: string; h1: string[]; h2: string[]; h3: string[];
    mainContentPreview: string; wordCount: number; lists: string[];
  };
  clinicalAnalysis: {
    isHealthContent: boolean; contentType: string;
    clinicalRiskRating: string; clinicalRiskRationale: string;
    aiSummarySimulation: string;
    survivalAnalysis: { survives: string[]; stripped: string[] };
    misrepresentationRisks: Array<{ risk: string; example: string; severity: string }>;
    robotsTxtAssessment: string; structuredDataAssessment: string;
    safetyRecommendations: string[]; overallVerdict: string;
  } | null;
  analysisError: string | null;
};

// ─── robots.txt tab ──────────────────────────────────────────────────────────

function RobotsTab({ robotsTxt }: { robotsTxt: ScrapeResult['robotsTxt'] }) {
  if (!robotsTxt.found || !robotsTxt.parsed) {
    return (
      <Alert variant="error" title="robots.txt not found">
        No robots.txt exists at this domain. All AI crawlers have unrestricted access to all content by default.
      </Alert>
    );
  }

  const { parsed } = robotsTxt;
  const blocked = parsed.crawlerAnalysis.filter(c => c.blocked).length;
  const partial = parsed.crawlerAnalysis.filter(c => c.partial).length;
  const allowed = parsed.crawlerAnalysis.length - blocked - partial;

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="flex items-start justify-between gap-4 p-4 bg-gray-50 rounded-lg">
        <div>
          <p className="font-medium text-gray-900">{parsed.overallSummary}</p>
          <div className="flex gap-3 mt-2 text-sm">
            <span className="text-green-700 font-medium">{blocked} blocked</span>
            <span className="text-orange-600 font-medium">{partial} partial</span>
            <span className="text-red-600 font-medium">{allowed} allowed</span>
          </div>
        </div>
        <RiskPill rating={parsed.overallRating} />
      </div>

      {/* Crawler table */}
      <div className="overflow-hidden border border-gray-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600 text-xs uppercase tracking-wide">Crawler</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600 text-xs uppercase tracking-wide hidden sm:table-cell">Owner</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600 text-xs uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600 text-xs uppercase tracking-wide hidden md:table-cell">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {parsed.crawlerAnalysis.map(c => (
              <tr key={c.agent} className="hover:bg-gray-50">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    {c.blocked
                      ? <ShieldOff className="w-3.5 h-3.5 text-green-600 shrink-0" />
                      : c.partial
                      ? <ShieldAlert className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                      : <ShieldCheck className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                    <span className="font-mono text-xs">{c.agent}</span>
                    {c.usedWildcard && <span className="text-[10px] text-gray-400 italic">wildcard</span>}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-xs text-gray-500 hidden sm:table-cell">{c.owner}</td>
                <td className="px-4 py-2.5">
                  <Badge variant={c.blocked ? 'green' : c.partial ? 'orange' : 'red'}>
                    {c.blocked ? 'Blocked' : c.partial ? 'Partial' : 'Allowed'}
                  </Badge>
                </td>
                <td className="px-4 py-2.5 text-xs text-gray-500 hidden md:table-cell">{c.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {parsed.sitemaps.length > 0 && (
        <p className="text-xs text-gray-500">
          <span className="font-medium">Sitemaps declared:</span> {parsed.sitemaps.join(', ')}
        </p>
      )}

      {robotsTxt.raw && (
        <CodeBlock label="View raw robots.txt" content={robotsTxt.raw} />
      )}
    </div>
  );
}

// ─── Structured data tab ─────────────────────────────────────────────────────

function StructuredDataTab({ data }: { data: ScrapeResult['structuredData'] }) {
  const { schemaAssessment, jsonLd, openGraph, twitterCard, metaTags } = data;
  const scoreColour = schemaAssessment.score >= 70 ? 'text-green-600' : schemaAssessment.score >= 40 ? 'text-orange-500' : 'text-red-600';
  const hasMeta = Object.values(metaTags).some(Boolean);
  const hasOG = Object.keys(openGraph).length > 0;

  return (
    <div className="space-y-5">
      {/* Score card */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <span className="font-medium text-gray-900">Clinical metadata quality score</span>
          <span className={`text-3xl font-bold ${scoreColour}`}>{schemaAssessment.score}<span className="text-base text-gray-400">/100</span></span>
        </div>
        <div className="space-y-2">
          {[
            { label: 'Health / medical Schema.org type declared', ok: schemaAssessment.hasHealthSchema },
            { label: 'Author or publisher information in metadata', ok: schemaAssessment.hasMedicalPublisherInfo },
            { label: 'Review date or publication date present', ok: schemaAssessment.hasDateInfo },
          ].map(({ label, ok }) => (
            <div key={label} className="flex items-center gap-2 text-sm">
              {ok
                ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                : <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
              <span className={ok ? 'text-gray-800' : 'text-gray-400'}>{label}</span>
            </div>
          ))}
        </div>
        {schemaAssessment.gaps.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs font-semibold text-red-600 mb-1">Missing:</p>
            {schemaAssessment.gaps.map(g => (
              <p key={g} className="text-xs text-gray-500">· {g}</p>
            ))}
          </div>
        )}
      </div>

      {/* JSON-LD */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          JSON-LD Structured Data ({jsonLd.length} block{jsonLd.length !== 1 ? 's' : ''})
        </p>
        {jsonLd.length === 0
          ? <p className="text-sm text-gray-400">No JSON-LD blocks found</p>
          : jsonLd.map((item: any, i) => (
              <CodeBlock
                key={i}
                label={`Block ${i + 1} — @type: ${[item['@type']].flat().filter(Boolean).join(', ') || 'unknown'}`}
                content={JSON.stringify(item, null, 2)}
              />
            ))
        }
      </div>

      {/* Open Graph */}
      {hasOG && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Open Graph Tags</p>
          <div className="border border-gray-200 rounded overflow-hidden">
            {Object.entries(openGraph).map(([k, v]) => (
              <div key={k} className="flex gap-3 px-3 py-2 border-b border-gray-100 last:border-0 text-xs">
                <span className="font-mono text-gray-400 shrink-0 w-36">og:{k}</span>
                <span className="text-gray-800 break-all">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Meta tags */}
      {hasMeta && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Meta / Head Tags</p>
          <div className="border border-gray-200 rounded overflow-hidden">
            {Object.entries(metaTags).filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="flex gap-3 px-3 py-2 border-b border-gray-100 last:border-0 text-xs">
                <span className="font-mono text-gray-400 shrink-0 w-36">{k}</span>
                <span className="text-gray-800 break-all">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasOG && !hasMeta && jsonLd.length === 0 && (
        <Alert variant="warning" title="No structured data found">
          This page has no machine-readable metadata. AI systems will have no context about authorship, dates, or clinical provenance.
        </Alert>
      )}
    </div>
  );
}

// ─── Scraped content tab ─────────────────────────────────────────────────────

function ScrapedContentTab({ content }: { content: ScrapeResult['scrapedContent'] }) {
  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Words extracted', value: content.wordCount.toLocaleString() },
          { label: 'H1 headings', value: content.h1.length },
          { label: 'H2 sections', value: content.h2.length },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-50 rounded-lg p-3 text-center border border-gray-200">
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Headings */}
      {content.h1.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Main Heading (H1)</p>
          {content.h1.map((h, i) => <p key={i} className="text-base font-semibold text-gray-900">{h}</p>)}
        </div>
      )}

      {content.h2.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Section Headings (H2)</p>
          <div className="flex flex-wrap gap-1.5">
            {content.h2.slice(0, 14).map((h, i) => (
              <span key={i} className="text-xs px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full border border-gray-200">{h}</span>
            ))}
            {content.h2.length > 14 && (
              <span className="text-xs px-2.5 py-1 bg-gray-100 text-gray-400 rounded-full border border-gray-200">+{content.h2.length - 14} more</span>
            )}
          </div>
        </div>
      )}

      {/* List items */}
      {content.lists.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            List Items Scraped ({content.lists.length}) — often clinical instructions
          </p>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <ul className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
              {content.lists.slice(0, 25).map((item, i) => (
                <li key={i} className="px-4 py-2 text-xs text-gray-700 flex gap-2">
                  <span className="text-gray-300 shrink-0">·</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Raw text */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Raw Text Content (what the scraper actually reads)
        </p>
        <pre className="text-xs text-gray-700 bg-gray-950 text-green-400 font-mono p-4 rounded-lg overflow-auto max-h-72 whitespace-pre-wrap">
          {content.mainContentPreview || '(no text content extracted)'}
        </pre>
      </div>
    </div>
  );
}

// ─── Clinical analysis tab ───────────────────────────────────────────────────

function ClinicalAnalysisTab({ analysis, error }: { analysis: ScrapeResult['clinicalAnalysis']; error: string | null }) {
  if (error || !analysis) {
    return (
      <Alert variant="error" title="Analysis unavailable">
        {error || 'Claude clinical analysis could not be completed.'}
      </Alert>
    );
  }

  const severityStyle: Record<string, string> = {
    critical: 'border-red-200 bg-red-50',
    serious:  'border-orange-200 bg-orange-50',
    moderate: 'border-yellow-200 bg-yellow-50',
  };
  const severityBadge: Record<string, string> = {
    critical: 'bg-red-600 text-white',
    serious:  'bg-orange-500 text-white',
    moderate: 'bg-yellow-500 text-white',
  };

  return (
    <div className="space-y-5">
      {/* Risk summary */}
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <p className="font-semibold text-gray-900">Clinical Risk Assessment</p>
            <p className="text-xs text-gray-500 mt-0.5">{analysis.contentType}</p>
          </div>
          <RiskPill rating={analysis.clinicalRiskRating} />
        </div>
        <p className="text-sm text-gray-700">{analysis.clinicalRiskRationale}</p>
      </div>

      {/* Simulated AI summary */}
      <div className="p-4 rounded-lg border border-orange-200 bg-orange-50">
        <div className="flex items-center gap-2 mb-2">
          <Bot className="w-4 h-4 text-orange-600" />
          <p className="text-xs font-bold text-orange-700 uppercase tracking-wide">
            Simulated 3-sentence AI summary of this page
          </p>
        </div>
        <p className="text-sm text-orange-900 italic">"{analysis.aiSummarySimulation}"</p>
        <p className="text-xs text-orange-600 mt-2">
          This is what a patient may receive from ChatGPT, Perplexity, or Google AI Overviews when asking about this topic.
        </p>
      </div>

      {/* What survives vs what gets stripped */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-4 rounded-lg border border-green-200 bg-green-50">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <p className="text-xs font-bold text-green-700 uppercase tracking-wide">Survives AI summarisation</p>
          </div>
          {analysis.survivalAnalysis.survives.length === 0
            ? <p className="text-xs text-green-600">Nothing identified</p>
            : <ul className="space-y-1.5">
                {analysis.survivalAnalysis.survives.map((item, i) => (
                  <li key={i} className="text-xs text-green-900 flex gap-1.5">
                    <span className="shrink-0">✓</span>{item}
                  </li>
                ))}
              </ul>
          }
        </div>
        <div className="p-4 rounded-lg border border-red-200 bg-red-50">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-4 h-4 text-red-500" />
            <p className="text-xs font-bold text-red-700 uppercase tracking-wide">Gets stripped out</p>
          </div>
          {analysis.survivalAnalysis.stripped.length === 0
            ? <p className="text-xs text-red-600">Nothing identified</p>
            : <ul className="space-y-1.5">
                {analysis.survivalAnalysis.stripped.map((item, i) => (
                  <li key={i} className="text-xs text-red-900 flex gap-1.5">
                    <span className="shrink-0">✗</span>{item}
                  </li>
                ))}
              </ul>
          }
        </div>
      </div>

      {/* Misrepresentation risks */}
      {analysis.misrepresentationRisks.length > 0 && (
        <div>
          <p className="font-semibold text-gray-900 mb-3">Specific Misrepresentation Risks</p>
          <div className="space-y-2">
            {analysis.misrepresentationRisks.map((risk, i) => (
              <div key={i} className={`p-3 rounded-lg border ${severityStyle[risk.severity] || 'border-gray-200 bg-gray-50'}`}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-medium text-gray-900">{risk.risk}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${severityBadge[risk.severity] || 'bg-gray-400 text-white'}`}>
                    {risk.severity}
                  </span>
                </div>
                <p className="text-xs text-gray-600 italic">e.g. "{risk.example}"</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Verdicts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3 rounded-lg border border-gray-200 bg-gray-50">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">robots.txt verdict</p>
          <p className="text-sm text-gray-800">{analysis.robotsTxtAssessment}</p>
        </div>
        <div className="p-3 rounded-lg border border-gray-200 bg-gray-50">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Structured data verdict</p>
          <p className="text-sm text-gray-800">{analysis.structuredDataAssessment}</p>
        </div>
      </div>

      {/* Recommendations */}
      {analysis.safetyRecommendations.length > 0 && (
        <div className="p-4 rounded-lg border border-nhs-blue/20 bg-blue-50">
          <p className="font-semibold text-nhs-blue mb-3">Safety Recommendations</p>
          <ol className="space-y-2">
            {analysis.safetyRecommendations.map((rec, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-800">
                <span className="text-nhs-blue font-bold shrink-0">{i + 1}.</span>
                {rec}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Overall verdict */}
      <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Overall Verdict</p>
        <p className="text-sm text-gray-800">{analysis.overallVerdict}</p>
      </div>
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'clinical',   label: 'Clinical Analysis',   icon: <Bot className="w-3.5 h-3.5" /> },
  { id: 'robots',     label: 'robots.txt',           icon: <Shield className="w-3.5 h-3.5" /> },
  { id: 'schema',     label: 'Structured Data',      icon: <Code2 className="w-3.5 h-3.5" /> },
  { id: 'content',    label: 'Scraped Content',      icon: <FileText className="w-3.5 h-3.5" /> },
];

const LOADING_STEPS = [
  'Fetching robots.txt…',
  'Scraping page content…',
  'Extracting structured data…',
  'Running Claude clinical safety analysis…',
];

export default function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('clinical');

  async function handleAnalyse() {
    const trimmed = url.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setLoadingStep(0);

    // Cycle through loading steps for UX
    const interval = setInterval(() => {
      setLoadingStep(s => Math.min(s + 1, LOADING_STEPS.length - 1));
    }, 3000);

    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setResult(data);
      setActiveTab('clinical');
    } catch (e: any) {
      setError(e.message || 'Unknown error');
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-nhs-pale-grey">

      {/* Header */}
      <header className="bg-nhs-blue text-white shadow-md">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center shrink-0">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">BHFT Website Checker</h1>
              <p className="text-xs text-blue-200">AI Scraping Risk & Clinical Content Analyser</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* URL input */}
        <Card>
          <CardBody>
            <label className="block text-sm font-semibold text-gray-800 mb-1">
              Enter a website URL to analyse
            </label>
            <p className="text-xs text-gray-500 mb-3">
              The tool will fetch the page, check robots.txt, extract structured data, and run a clinical AI safety analysis.
            </p>
            <div className="flex gap-2">
              <Input
                type="url"
                placeholder="https://www.bhft.nhs.uk/services/eating-disorders"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAnalyse()}
                disabled={loading}
                className="font-mono"
              />
              <Button onClick={handleAnalyse} disabled={loading || !url.trim()} className="shrink-0">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {loading ? 'Analysing…' : 'Analyse'}
              </Button>
            </div>
            <div className="flex items-start gap-1.5 mt-3">
              <Info className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
              <p className="text-xs text-gray-400">
                Try any public NHS or trust URL. Good examples: patient information pages, service descriptions, crisis advice pages, medication leaflets.
              </p>
            </div>
          </CardBody>
        </Card>

        {/* Error */}
        {error && (
          <Alert variant="error" title="Analysis failed">
            {error}
          </Alert>
        )}

        {/* Loading */}
        {loading && (
          <Card>
            <CardBody className="space-y-3">
              {LOADING_STEPS.map((step, i) => (
                <div key={step} className={`flex items-center gap-3 text-sm transition-opacity ${i <= loadingStep ? 'opacity-100' : 'opacity-30'}`}>
                  {i < loadingStep
                    ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    : i === loadingStep
                    ? <Loader2 className="w-4 h-4 text-nhs-blue animate-spin shrink-0" />
                    : <div className="w-4 h-4 rounded-full border-2 border-gray-200 shrink-0" />}
                  <span className={i === loadingStep ? 'text-gray-900 font-medium' : 'text-gray-500'}>{step}</span>
                </div>
              ))}
            </CardBody>
          </Card>
        )}

        {/* Results */}
        {result && !loading && (
          <>
            {/* Summary bar */}
            <Card>
              <CardBody className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">Analysed</p>
                  <p className="font-mono text-sm font-medium text-gray-900 truncate">{result.url}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(result.fetchedAt).toLocaleString('en-GB')} · {(result.durationMs / 1000).toFixed(1)}s
                  </p>
                </div>
                <div className="flex gap-4 shrink-0">
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">robots.txt</p>
                    <RiskPill rating={result.robotsTxt.found ? (result.robotsTxt.parsed?.overallRating ?? 'none') : 'none'} />
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">Schema</p>
                    <span className="text-sm font-bold text-gray-900">{result.structuredData.schemaAssessment.score}/100</span>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">Clinical risk</p>
                    <RiskPill rating={result.clinicalAnalysis?.clinicalRiskRating ?? 'none'} />
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Tabs */}
            <Card>
              <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />
              <CardBody>
                {activeTab === 'clinical' && (
                  <ClinicalAnalysisTab analysis={result.clinicalAnalysis} error={result.analysisError} />
                )}
                {activeTab === 'robots' && (
                  <RobotsTab robotsTxt={result.robotsTxt} />
                )}
                {activeTab === 'schema' && (
                  <StructuredDataTab data={result.structuredData} />
                )}
                {activeTab === 'content' && (
                  <ScrapedContentTab content={result.scrapedContent} />
                )}
              </CardBody>
            </Card>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-10 border-t border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <p className="text-xs text-gray-400">BHFT Website Checker · For internal governance use</p>
          <p className="text-xs text-gray-400">Powered by Claude AI</p>
        </div>
      </footer>
    </div>
  );
}
