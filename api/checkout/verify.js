export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { token, session_id } = req.query

  // Handle test tokens
  if (token && token.startsWith('test_')) {
    const match = token.match(/^test_tier(\d+)_/)
    if (match) {
      return res.status(200).json({
        valid: true,
        tier: Number(match[1]),
        testMode: true,
        token,
      })
    }
  }

  // Handle Stripe session_id (from success redirect)
  if (session_id && process.env.STRIPE_SECRET_KEY) {
    try {
      const Stripe = (await import('stripe')).default
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
      const session = await stripe.checkout.sessions.retrieve(session_id)
      if (session.payment_status === 'paid') {
        const tier = Number(session.metadata?.tier) || 2
        const newToken = `stripe_tier${tier}_${session_id}`
        return res.status(200).json({ valid: true, tier, testMode: false, token: newToken })
      }
    } catch (_) {
      return res.status(200).json({ valid: false })
    }
  }

  // Handle existing stripe tokens
  if (token && token.startsWith('stripe_') && process.env.STRIPE_SECRET_KEY) {
    const match = token.match(/^stripe_tier(\d+)_(.+)/)
    if (match) {
      try {
        const Stripe = (await import('stripe')).default
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
        const session = await stripe.checkout.sessions.retrieve(match[2])
        if (session.payment_status === 'paid') {
          return res.status(200).json({
            valid: true,
            tier: Number(match[1]),
            testMode: false,
            token,
          })
        }
      } catch (_) {
        // Fall through to invalid
      }
    }
  }

  return res.status(200).json({ valid: false })
}
