export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { tier, test } = req.query
  const tierNum = Number(tier) || 2

  if (tierNum !== 2 && tierNum !== 3) {
    return res.status(400).json({ error: 'Invalid tier. Must be 2 or 3.' })
  }

  // Test mode bypass (no Stripe needed)
  if (test === 'true' || !process.env.STRIPE_SECRET_KEY) {
    const token = `test_tier${tierNum}_${Date.now()}_${Math.random().toString(36).slice(2)}`
    return res.status(200).json({
      mode: 'test',
      token,
      tier: tierNum,
      message: 'Test access granted - no payment taken',
    })
  }

  // Real Stripe checkout
  try {
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

    const prices = {
      2: process.env.STRIPE_PRICE_TIER2 || 'price_placeholder_tier2',
      3: process.env.STRIPE_PRICE_TIER3 || 'price_placeholder_tier3',
    }

    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: prices[tierNum], quantity: 1 }],
      success_url: `${baseUrl}/?session_id={CHECKOUT_SESSION_ID}&tier=${tierNum}`,
      cancel_url: `${baseUrl}/?cancelled=true`,
      metadata: { tier: String(tierNum) },
    })

    return res.status(200).json({ mode: 'stripe', url: session.url })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
