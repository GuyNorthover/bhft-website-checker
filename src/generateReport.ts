import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, ShadingType, Header, Footer, PageNumber,
  NumberFormat, convertInchesToTwip, TableLayoutType,
  VerticalAlign, UnderlineType,
} from 'docx'

// ── Types (mirrored from App.tsx) ──────────────────────────────────────────

interface RobotsTxtAnalysis {
  exists: boolean; summary: string; aiProtection: 'none' | 'partial' | 'good'
  allowsAIScraping: boolean; keyDirectives: string[]; recommendation: string
}
interface StructuredDataAnalysis {
  found: boolean; types: string[]; quality: string
  summary: string; aiImpact: string; recommendation: string
}
interface ClinicalAnalysis {
  hasClinicalContent: boolean; contentTypes: string[]; accuracy: string
  misrepresentationRisk: 'low' | 'medium' | 'high' | 'critical'
  misrepresentationConcerns: string[]; outOfContextRisks: string[]; recommendation: string
}
interface OverallRisk {
  score: number; level: string; summary: string
  topConcerns: string[]; immediateActions: string[]
}
interface ScrapingProfile {
  whatAIWouldExtract: string[]; howItWouldBeUsed: string; potentialHarms: string[]
}
interface Analysis {
  robotsTxt: RobotsTxtAnalysis; structuredData: StructuredDataAnalysis
  clinicalInformation: ClinicalAnalysis; overallRisk: OverallRisk; scrapingProfile: ScrapingProfile
}
interface ScrapeResult {
  url: string; title: string; robotsTxt: string | null; structuredData: object[]; analysis: Analysis
}

// ── Colour helpers ─────────────────────────────────────────────────────────

function riskHex(level: string) {
  switch (level) {
    case 'low':      return 'D1FAE5' // green-100
    case 'medium':   return 'FEF3C7' // yellow-100
    case 'high':     return 'FFEDD5' // orange-100
    case 'critical': return 'FEE2E2' // red-100
    default:         return 'F3F4F6'
  }
}

function riskTextHex(level: string) {
  switch (level) {
    case 'low':      return '065F46'
    case 'medium':   return '92400E'
    case 'high':     return '9A3412'
    case 'critical': return '7F1D1D'
    default:         return '374151'
  }
}

function scoreHex(score: number) {
  if (score <= 3) return '059669'
  if (score <= 5) return 'D97706'
  if (score <= 7) return 'EA580C'
  return 'DC2626'
}

// ── Reusable paragraph builders ────────────────────────────────────────────

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

function heading3(text: string) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 22, color: '1F2937' })],
    spacing: { before: 200, after: 80 },
  })
}

function bodyText(text: string) {
  return new Paragraph({
    children: [new TextRun({ text, size: 20, color: '374151' })],
    spacing: { after: 100 },
  })
}

function labelText(text: string) {
  return new Paragraph({
    children: [new TextRun({ text: text.toUpperCase(), size: 16, color: '6B7280', bold: true })],
    spacing: { before: 160, after: 60 },
  })
}

function bulletPoint(text: string, indent = 360) {
  return new Paragraph({
    children: [new TextRun({ text: `• ${text}`, size: 20, color: '374151' })],
    indent: { left: indent },
    spacing: { after: 80 },
  })
}

function warningBullet(text: string) {
  return new Paragraph({
    children: [new TextRun({ text: `⚠ ${text}`, size: 20, color: '9A3412' })],
    indent: { left: 360 },
    spacing: { after: 80 },
  })
}

function spacer(lines = 1) {
  return Array.from({ length: lines }, () => new Paragraph({ text: '', spacing: { after: 80 } }))
}

function divider() {
  return new Paragraph({
    text: '',
    spacing: { before: 200, after: 200 },
    border: { bottom: { color: 'E5E7EB', size: 4, style: BorderStyle.SINGLE, space: 2 } },
  })
}

function recommendationBox(text: string) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.SOLID, color: 'EFF6FF', fill: 'EFF6FF' },
            borders: {
              top: { style: BorderStyle.SINGLE, color: '3B82F6', size: 4 },
              bottom: { style: BorderStyle.SINGLE, color: 'BFDBFE', size: 2 },
              left: { style: BorderStyle.SINGLE, color: '3B82F6', size: 12 },
              right: { style: BorderStyle.SINGLE, color: 'BFDBFE', size: 2 },
            },
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            children: [
              new Paragraph({
                children: [new TextRun({ text: 'RECOMMENDATION', bold: true, size: 16, color: '1D4ED8' })],
                spacing: { after: 60 },
              }),
              new Paragraph({
                children: [new TextRun({ text, size: 20, color: '1E3A5F' })],
              }),
            ],
          }),
        ],
      }),
    ],
  })
}

// ── Score summary table ────────────────────────────────────────────────────

function scoreSummaryTable(result: ScrapeResult) {
  const risk = result.analysis.overallRisk
  const bg = riskHex(risk.level)
  const fg = riskTextHex(risk.level)
  const scoreColor = scoreHex(risk.score)

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        children: [
          // Score cell
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color: bg, fill: bg },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 200, bottom: 200, left: 200, right: 200 },
            borders: {
              top: { style: BorderStyle.SINGLE, color: 'D1D5DB', size: 4 },
              bottom: { style: BorderStyle.SINGLE, color: 'D1D5DB', size: 4 },
              left: { style: BorderStyle.SINGLE, color: 'D1D5DB', size: 4 },
              right: { style: BorderStyle.SINGLE, color: 'D1D5DB', size: 4 },
            },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: `${risk.score}/10`, bold: true, size: 56, color: scoreColor })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: risk.level.toUpperCase() + ' RISK', bold: true, size: 20, color: fg })],
                spacing: { before: 80 },
              }),
            ],
          }),
          // Summary cell
          new TableCell({
            width: { size: 75, type: WidthType.PERCENTAGE },
            margins: { top: 200, bottom: 200, left: 240, right: 200 },
            borders: {
              top: { style: BorderStyle.SINGLE, color: 'D1D5DB', size: 4 },
              bottom: { style: BorderStyle.SINGLE, color: 'D1D5DB', size: 4 },
              left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              right: { style: BorderStyle.SINGLE, color: 'D1D5DB', size: 4 },
            },
            children: [
              new Paragraph({
                children: [new TextRun({ text: result.title, bold: true, size: 24, color: '111827' })],
                spacing: { after: 80 },
              }),
              new Paragraph({
                children: [new TextRun({ text: result.url, size: 18, color: '2563EB', underline: { type: UnderlineType.SINGLE } })],
                spacing: { after: 120 },
              }),
              new Paragraph({
                children: [new TextRun({ text: risk.summary, size: 20, color: '374151' })],
              }),
            ],
          }),
        ],
      }),
    ],
  })
}

// ── Quick-reference badge row ──────────────────────────────────────────────

function badgeRow(items: { label: string; value: string; ok: boolean }[]) {
  const cells = items.map(({ label, value, ok }) =>
    new TableCell({
      shading: { type: ShadingType.SOLID, color: ok ? 'D1FAE5' : 'FEE2E2', fill: ok ? 'D1FAE5' : 'FEE2E2' },
      borders: {
        top: { style: BorderStyle.SINGLE, color: 'E5E7EB', size: 2 },
        bottom: { style: BorderStyle.SINGLE, color: 'E5E7EB', size: 2 },
        left: { style: BorderStyle.SINGLE, color: 'E5E7EB', size: 2 },
        right: { style: BorderStyle.SINGLE, color: 'E5E7EB', size: 2 },
      },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [
        new Paragraph({
          children: [new TextRun({ text: label, size: 16, color: '6B7280', bold: true })],
        }),
        new Paragraph({
          children: [new TextRun({ text: value, size: 18, bold: true, color: ok ? '065F46' : '7F1D1D' })],
        }),
      ],
    })
  )

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [new TableRow({ children: cells })],
  })
}

// ── Main document builder ──────────────────────────────────────────────────

export async function generateWordReport(result: ScrapeResult): Promise<void> {
  const { analysis } = result
  const risk = analysis.overallRisk
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'action-numbering',
          levels: [{ level: 0, format: NumberFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) } } } }],
        },
      ],
    },
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 20, color: '1F2937' } },
      },
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          run: { bold: true, size: 32, color: '005EB8', font: 'Calibri' },
          paragraph: { spacing: { before: 400, after: 200 } },
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          run: { bold: true, size: 26, color: '1F2937', font: 'Calibri' },
          paragraph: { spacing: { before: 300, after: 120 } },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1.2),
              right: convertInchesToTwip(1.2),
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'Healthcare Website AI Risk Checker', size: 18, color: '6B7280' }),
                  new TextRun({ text: `   |   Generated ${dateStr} at ${timeStr}`, size: 18, color: '9CA3AF' }),
                ],
                border: { bottom: { color: 'E5E7EB', size: 4, style: BorderStyle.SINGLE, space: 4 } },
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'Healthcare Website AI Risk Checker  ·  Powered by Claude AI  ·  Page ', size: 16, color: '9CA3AF' }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '9CA3AF' }),
                  new TextRun({ text: ' of ', size: 16, color: '9CA3AF' }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: '9CA3AF' }),
                ],
                border: { top: { color: 'E5E7EB', size: 4, style: BorderStyle.SINGLE, space: 4 } },
              }),
            ],
          }),
        },
        children: [

          // ── Cover / Title ──────────────────────────────────────────────
          new Paragraph({
            children: [
              new TextRun({ text: 'NHS', bold: true, size: 36, color: 'FFFFFF',
                shading: { type: ShadingType.SOLID, color: '005EB8', fill: '005EB8' } }),
              new TextRun({ text: '  Healthcare Website', bold: true, size: 36, color: '005EB8' }),
            ],
            spacing: { after: 80 },
          }),
          new Paragraph({
            children: [new TextRun({ text: 'AI Risk Assessment Report', bold: true, size: 48, color: '111827' })],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Prepared: ', size: 20, color: '6B7280' }),
              new TextRun({ text: `${dateStr} at ${timeStr}`, size: 20, color: '374151', bold: true }),
            ],
            spacing: { after: 80 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Website Analysed: ', size: 20, color: '6B7280' }),
              new TextRun({ text: result.url, size: 20, color: '2563EB', bold: true }),
            ],
            spacing: { after: 80 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Page Title: ', size: 20, color: '6B7280' }),
              new TextRun({ text: result.title || 'Not detected', size: 20, color: '374151' }),
            ],
            spacing: { after: 400 },
          }),

          divider(),

          // ── Executive Summary ──────────────────────────────────────────
          heading1('Executive Summary'),
          scoreSummaryTable(result),
          ...spacer(1),

          // Quick badge row
          badgeRow([
            { label: 'robots.txt', value: analysis.robotsTxt.exists ? 'Present' : 'Missing', ok: analysis.robotsTxt.exists },
            { label: 'AI Crawlers', value: analysis.robotsTxt.allowsAIScraping ? 'Unrestricted' : 'Restricted', ok: !analysis.robotsTxt.allowsAIScraping },
            { label: 'Structured Data', value: analysis.structuredData.found ? 'Found' : 'None', ok: analysis.structuredData.quality !== 'none' },
            { label: 'Clinical Risk', value: analysis.clinicalInformation.misrepresentationRisk.toUpperCase(), ok: analysis.clinicalInformation.misrepresentationRisk === 'low' },
          ]),
          ...spacer(1),
          divider(),

          // ── 1. robots.txt ──────────────────────────────────────────────
          heading1('1. robots.txt Analysis'),
          labelText('Status'),
          bodyText(analysis.robotsTxt.exists
            ? `A robots.txt file was found at ${result.url.replace(/\/$/, '')}/robots.txt.`
            : `No robots.txt file was found. This means AI crawlers have unrestricted access to all pages on this website.`),
          labelText('AI Protection Level'),
          bodyText(`Protection level: ${analysis.robotsTxt.aiProtection.toUpperCase()} — AI scraping is currently ${analysis.robotsTxt.allowsAIScraping ? 'PERMITTED' : 'RESTRICTED'}.`),
          labelText('Summary'),
          bodyText(analysis.robotsTxt.summary),

          ...(analysis.robotsTxt.keyDirectives.length > 0
            ? [labelText('Key Directives Found'), ...analysis.robotsTxt.keyDirectives.map(d => bulletPoint(d))]
            : []),

          ...spacer(1),
          recommendationBox(analysis.robotsTxt.recommendation),
          ...spacer(1),
          divider(),

          // ── 2. Structured Data ────────────────────────────────────────
          heading1('2. Structured Data Markup'),
          labelText('Status'),
          bodyText(analysis.structuredData.found
            ? `Structured data markup was found on this page. Quality: ${analysis.structuredData.quality.toUpperCase()}.`
            : 'No structured data markup (JSON-LD, Microdata, or RDFa) was detected on this page.'),

          ...(analysis.structuredData.types.length > 0
            ? [labelText('Schema Types Found'), ...analysis.structuredData.types.map(t => bulletPoint(t))]
            : []),

          labelText('Summary'),
          bodyText(analysis.structuredData.summary),
          labelText('How AI Would Use This'),
          bodyText(analysis.structuredData.aiImpact),
          ...spacer(1),
          recommendationBox(analysis.structuredData.recommendation),
          ...spacer(1),
          divider(),

          // ── 3. Clinical Information ───────────────────────────────────
          heading1('3. Clinical Information Review'),
          labelText('Clinical Content Detected'),
          bodyText(analysis.clinicalInformation.hasClinicalContent
            ? `Clinical content was identified on this page. Misrepresentation risk: ${analysis.clinicalInformation.misrepresentationRisk.toUpperCase()}.`
            : 'No significant clinical content was detected on this page.'),

          ...(analysis.clinicalInformation.contentTypes.length > 0
            ? [labelText('Content Types Identified'), ...analysis.clinicalInformation.contentTypes.map(t => bulletPoint(t))]
            : []),

          labelText('Accuracy Assessment'),
          bodyText(analysis.clinicalInformation.accuracy),

          ...(analysis.clinicalInformation.misrepresentationConcerns.length > 0 ? [
            labelText('Misrepresentation Concerns'),
            ...analysis.clinicalInformation.misrepresentationConcerns.map(c => warningBullet(c)),
          ] : []),

          ...(analysis.clinicalInformation.outOfContextRisks.length > 0 ? [
            labelText('Out-of-Context Risks'),
            ...analysis.clinicalInformation.outOfContextRisks.map(r => bulletPoint(r)),
          ] : []),

          ...spacer(1),
          recommendationBox(analysis.clinicalInformation.recommendation),
          ...spacer(1),
          divider(),

          // ── 4. Scraping Profile ───────────────────────────────────────
          heading1('4. AI Scraping Profile'),
          labelText('What AI Would Extract'),
          ...analysis.scrapingProfile.whatAIWouldExtract.map(item => bulletPoint(item)),
          labelText('How Scraped Content Would Be Used'),
          bodyText(analysis.scrapingProfile.howItWouldBeUsed),

          ...(analysis.scrapingProfile.potentialHarms.length > 0 ? [
            labelText('Potential Harms'),
            ...analysis.scrapingProfile.potentialHarms.map(h => warningBullet(h)),
          ] : []),

          ...spacer(1),
          divider(),

          // ── 5. Immediate Actions ──────────────────────────────────────
          heading1('5. Immediate Actions Required'),
          ...risk.immediateActions.map((action, i) =>
            new Paragraph({
              children: [
                new TextRun({ text: `${i + 1}.  `, bold: true, size: 20, color: '005EB8' }),
                new TextRun({ text: action, size: 20, color: '1F2937' }),
              ],
              spacing: { after: 120 },
              indent: { left: 0 },
            })
          ),

          ...(risk.topConcerns.length > 0 ? [
            ...spacer(1),
            labelText('Top Concerns'),
            ...risk.topConcerns.map(c => bulletPoint(c)),
          ] : []),

          ...spacer(1),
          divider(),

          // ── 6. About this tool ────────────────────────────────────────
          heading1('6. About This Assessment'),
          bodyText('This report was generated by the Healthcare Website AI Risk Checker, a clinical governance tool developed to help NHS and healthcare organisations understand how AI web scraping tools interpret, extract, and potentially misrepresent their website content.'),
          ...spacer(1),
          bodyText('The analysis was performed using live data fetched from the website at the time of this report. Results may change if the website content, robots.txt file, or structured data markup is updated.'),
          ...spacer(1),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    shading: { type: ShadingType.SOLID, color: 'F9FAFB', fill: 'F9FAFB' },
                    borders: {
                      top: { style: BorderStyle.SINGLE, color: 'E5E7EB', size: 4 },
                      bottom: { style: BorderStyle.SINGLE, color: 'E5E7EB', size: 4 },
                      left: { style: BorderStyle.SINGLE, color: 'E5E7EB', size: 4 },
                      right: { style: BorderStyle.SINGLE, color: 'E5E7EB', size: 4 },
                    },
                    margins: { top: 160, bottom: 160, left: 200, right: 200 },
                    children: [
                      new Paragraph({ children: [new TextRun({ text: 'Key References', bold: true, size: 20, color: '374151' })], spacing: { after: 120 } }),
                      ...([
                        ['NHS AI IG Guidance', 'transform.england.nhs.uk/information-governance/guidance/artificial-intelligence/'],
                        ['NHS Digital Service Manual — Point 16', 'service-manual.nhs.uk/standards-and-technology/service-standard-points/16-make-your-service-clinically-safe'],
                        ['UKMi Position Statement on AI', 'www.ukmi.nhs.uk/fileDownloader.aspx?ID=295'],
                        ['ICO — Web Scraping & AI', 'ico.org.uk/media2/p3mkalna/our-response-to-uk-governments-consultation-on-copyright-and-artificial-intelligence.pdf'],
                        ['NHS Confederation AI Framework', 'www.nhsconfed.org/publications/nhs-communications-artificial-intelligence-operating-framework'],
                      ].map(([label, url]) =>
                        new Paragraph({
                          children: [
                            new TextRun({ text: `${label}: `, size: 18, bold: true, color: '374151' }),
                            new TextRun({ text: url, size: 18, color: '2563EB' }),
                          ],
                          spacing: { after: 60 },
                        })
                      )),
                    ],
                  }),
                ],
              }),
            ],
          }),

          ...spacer(2),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: `Healthcare Website AI Risk Checker  ·  ${dateStr}  ·  Powered by Claude AI`, size: 16, color: '9CA3AF' })],
          }),
        ],
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  const safeName = result.url.replace(/https?:\/\//, '').replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').slice(0, 40)
  const filename = `ai-risk-report-${safeName}-${now.toISOString().slice(0, 10)}.docx`

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
