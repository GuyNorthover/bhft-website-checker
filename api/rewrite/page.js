import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { url, title, content, concerns, contentTypes } = req.body || {}
  if (!url || !content) return res.status(400).json({ error: 'URL and content required' })

  const prompt = `You are an NHS clinical content specialist. Rewrite this healthcare webpage content to meet all NHS Digital Service Manual standards and clinical safety requirements.

Original page URL: ${url}
Original title: ${title}
Content types identified: ${(contentTypes || []).join(', ')}
AI misrepresentation concerns: ${(concerns || []).join('; ')}

ORIGINAL CONTENT:
${content.substring(0, 3000)}

Rewrite this content following these mandatory standards:

1. NHS PLAIN ENGLISH: Grade 8 or below Flesch-Kincaid. Short sentences (max 20 words). No jargon without explanation.
2. CLINICAL SAFETY (DCB0129): All clinical statements must include appropriate context and caveats. Never present clinical information without specifying "speak to your GP/clinician" where appropriate.
3. NHS DIGITAL SERVICE MANUAL: Use active voice, second person ("you"), clear headings, bullet points for lists.
4. AI SCRAPING PROTECTION: Include explicit statements that this information is for general guidance only and should not replace professional medical advice.
5. CONTEXT PRESERVATION: Every clinical claim must retain its full context - never allow extraction of a number, dose or instruction without its accompanying caveats.

Return ONLY valid JSON:
{
  "rewrittenTitle": "improved page title",
  "rewrittenContent": "full rewritten page content in HTML-like markdown with ## headings, **bold**, bullet points",
  "keyChanges": ["list of specific changes made and why"],
  "clinicalCaveatsAdded": ["specific caveats added to protect against AI misrepresentation"],
  "suggestedMetaDescription": "SEO meta description under 160 chars that won't be misused by AI",
  "suggestedJsonLd": { "type": "MedicalWebPage", "example": "valid JSON-LD structured data object for this page" },
  "robotsTxtAdditions": "specific robots.txt lines to add for this page type",
  "complianceNotes": ["NHS standards this rewrite now meets"],
  "readabilityScore": "estimated Flesch-Kincaid grade level of rewritten content"
}`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    let result
    try {
      result = JSON.parse(responseText)
    } catch {
      const match = responseText.match(/\{[\s\S]*\}/)
      if (match) {
        result = JSON.parse(match[0])
      } else {
        throw new Error('Could not parse rewrite response')
      }
    }

    return res.status(200).json({ url, title, original: content, ...result })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
