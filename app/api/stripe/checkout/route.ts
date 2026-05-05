import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const PLANS: Record<string, { priceId: string; credits: number; label: string }> = {
  starter: {
    priceId: process.env.STRIPE_PRICE_STARTER!,
    credits: 10,
    label: 'Starter — 10 kreditů',
  },
  pro: {
    priceId: process.env.STRIPE_PRICE_PRO!,
    credits: 50,
    label: 'Pro — 50 kreditů',
  },
  team: {
    priceId: process.env.STRIPE_PRICE_TEAM!,
    credits: 200,
    label: 'Team — 200 kreditů',
  },
}

export async function POST(req: NextRequest) {
  const { plan } = await req.json()

  const selected = PLANS[plan]
  if (!selected) {
    return NextResponse.json({ error: 'Neplatný plán.' }, { status: 400 })
  }

  const origin = req.headers.get('origin') || 'http://localhost:3000'

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: selected.priceId }],
      success_url: `${origin}/koupit/success?credits=${selected.credits}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/koupit`,
      metadata: { credits: selected.credits.toString(), plan },
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error('[Stripe] checkout error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
