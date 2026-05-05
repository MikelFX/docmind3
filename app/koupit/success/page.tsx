'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import styles from './page.module.css'

function SuccessContent() {
  const params = useSearchParams()
  const router = useRouter()
  const credits = parseInt(params.get('credits') || '0')
  const [total, setTotal] = useState(0)

  useEffect(() => {
    if (credits > 0) {
      const existing = parseInt(localStorage.getItem('docmind_credits') || '0')
      const newTotal = existing + credits
      localStorage.setItem('docmind_credits', newTotal.toString())
      setTotal(newTotal)
    }
  }, [credits])

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.icon}>✅</div>
        <h1 className={styles.title}>Platba proběhla úspěšně!</h1>
        <p className={styles.sub}>
          Bylo ti připsáno <strong>{credits} kreditů</strong>.{' '}
          Celkem máš nyní <strong>{total} kreditů</strong>.
        </p>
        <button className={styles.btn} onClick={() => router.push('/')}>
          Zpět do DocMind →
        </button>
      </div>
    </div>
  )
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
        Načítám...
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}
