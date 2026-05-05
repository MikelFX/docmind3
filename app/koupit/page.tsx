'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './page.module.css'

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    credits: 10,
    price: 4.99,
    pricePerDoc: '0.50',
    description: 'Ideální pro vyzkoušení',
    highlight: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    credits: 50,
    price: 14.99,
    pricePerDoc: '0.30',
    description: 'Nejoblíbenější volba',
    highlight: true,
  },
  {
    id: 'team',
    name: 'Team',
    credits: 200,
    price: 49.99,
    pricePerDoc: '0.25',
    description: 'Pro firmy a týmy',
    highlight: false,
  },
]

export default function KoupitPage() {
  const [selected, setSelected] = useState('pro')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleBuy() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: selected }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      window.location.href = data.url
    } catch (err: any) {
      setError(err.message || 'Nepodařilo se spustit platbu. Zkus znovu.')
      setLoading(false)
    }
  }

  const plan = PLANS.find(p => p.id === selected)!

  return (
    <div className={styles.wrap}>
      <nav className={styles.nav}>
        <button className={styles.back} onClick={() => router.push('/')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
          Zpět
        </button>
        <div className={styles.logo}><div className={styles.logoDot} />docmind</div>
        <div style={{ width: 80 }} />
      </nav>

      <div className={styles.content}>
        <div className={styles.header}>
          <h1 className={styles.title}>Koupit kredity</h1>
          <p className={styles.sub}>Každý kredit = jedna analýza dokumentu. Kredity nevyprší.</p>
        </div>

        <div className={styles.plans}>
          {PLANS.map(p => (
            <button
              key={p.id}
              className={`${styles.plan} ${selected === p.id ? styles.planActive : ''} ${p.highlight ? styles.planHighlight : ''}`}
              onClick={() => setSelected(p.id)}
            >
              {p.highlight && <div className={styles.badge}>Nejoblíbenější</div>}
              <div className={styles.planName}>{p.name}</div>
              <div className={styles.planPrice}>
                <span className={styles.planAmount}>${p.price}</span>
              </div>
              <div className={styles.planCredits}>{p.credits} kreditů</div>
              <div className={styles.planPer}>${p.pricePerDoc} / dokument</div>
              <div className={styles.planDesc}>{p.description}</div>
            </button>
          ))}
        </div>

        <div className={styles.summary}>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Balíček</span>
            <span className={styles.summaryVal}>{plan.name} — {plan.credits} kreditů</span>
          </div>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Cena za dokument</span>
            <span className={styles.summaryVal}>${plan.pricePerDoc}</span>
          </div>
          <div className={styles.summaryDivider} />
          <div className={styles.summaryRow}>
            <span className={styles.summaryTotal}>Celkem</span>
            <span className={styles.summaryTotalVal}>${plan.price}</span>
          </div>

          {error && (
            <p style={{ color: '#F09595', fontSize: 13, marginTop: 12 }}>{error}</p>
          )}

          <button className={styles.buyBtn} onClick={handleBuy} disabled={loading}>
            {loading ? (
              <span className={styles.dots}><span /><span /><span /></span>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                  <line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
                Zaplatit ${plan.price} přes Stripe
              </>
            )}
          </button>

          <p className={styles.legal}>
            🔒 Bezpečná platba přes Stripe. Kredity jsou připsány okamžitě po zaplacení.
          </p>
        </div>

        <div className={styles.faq}>
          <div className={styles.faqItem}>
            <div className={styles.faqQ}>Vyprší kredity?</div>
            <div className={styles.faqA}>Ne, kredity jsou trvalé a nevyprší.</div>
          </div>
          <div className={styles.faqItem}>
            <div className={styles.faqQ}>Jaké dokumenty DocMind podporuje?</div>
            <div className={styles.faqA}>PDF, Word (.docx) a textové soubory (.txt).</div>
          </div>
          <div className={styles.faqItem}>
            <div className={styles.faqQ}>Jsou moje dokumenty v bezpečí?</div>
            <div className={styles.faqA}>Dokumenty se zpracují a nejsou nikde ukládány.</div>
          </div>
          <div className={styles.faqItem}>
            <div className={styles.faqQ}>Jak platba funguje?</div>
            <div className={styles.faqA}>Po kliknutí tě přesměrujeme na zabezpečenou Stripe platební stránku. Po zaplacení se automaticky vrátíš zpět a kredity se přičtou.</div>
          </div>
        </div>
      </div>
    </div>
  )
}
