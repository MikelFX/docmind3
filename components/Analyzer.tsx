'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import styles from './Analyzer.module.css'

type Mode = 'summary' | 'actions' | 'risks' | 'qa'

interface HistoryItem {
  id: string
  fileName: string
  mode: Mode
  result: string
  date: string
}

const MODES: { id: Mode; label: string; icon: string }[] = [
  { id: 'summary', label: 'Shrnutí', icon: '📋' },
  { id: 'actions', label: 'Akční body', icon: '✅' },
  { id: 'risks', label: 'Rizika', icon: '⚠️' },
  { id: 'qa', label: 'Otázky & odpovědi', icon: '💬' },
]

const DEMO_TEXT = `DocMind Demo: Toto je ukázkový analytický dokument.
Projekt: Implementace CRM systému Q3 2025.
Zodpovědná osoba: Jana Nováková (PM), deadline 15.9.2025.
Úkoly: dokončit API integraci, otestovat import dat, školení týmu.
Rizika: závislost na externím dodavateli, možné zpoždění o 2-3 týdny.
Rozpočet: 450 000 Kč, aktuálně proinvestováno 280 000 Kč.
Závěr: projekt je v plánu, nutné sledovat rizika dodavatele.`

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

export default function Analyzer() {
  const [mode, setMode] = useState<Mode>('summary')
  const [fileContent, setFileContent] = useState('')
  const [fileName, setFileName] = useState('')
  const [fileSize, setFileSize] = useState('')
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  const [credits, setCredits] = useState(3)
  const [question, setQuestion] = useState('')
  const [qLoading, setQLoading] = useState(false)
  const [answers, setAnswers] = useState<{ q: string; a: string }[]>([])
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [copied, setCopied] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    const saved = localStorage.getItem('docmind_history')
    if (saved) setHistory(JSON.parse(saved))
    const savedCredits = localStorage.getItem('docmind_credits')
    if (savedCredits) setCredits(parseInt(savedCredits))
  }, [])

  function saveToHistory(res: string, fname: string, m: Mode) {
    const item: HistoryItem = {
      id: Date.now().toString(),
      fileName: fname || 'demo text',
      mode: m,
      result: res,
      date: new Date().toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
    }
    const updated = [item, ...history].slice(0, 5)
    setHistory(updated)
    localStorage.setItem('docmind_history', JSON.stringify(updated))
  }

  function loadFromHistory(item: HistoryItem) {
    setResult(item.result)
    setMode(item.mode)
    setFileName(item.fileName)
    setAnswers([])
  }

  function handleFile(file: File) {
    setFileName(file.name)
    const kb = Math.round(file.size / 1024)
    setFileSize(kb > 1024 ? (kb / 1024).toFixed(1) + ' MB' : kb + ' KB')
    const reader = new FileReader()
    reader.onload = (e) => setFileContent(e.target?.result as string)
    reader.readAsText(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  async function analyze() {
    if (credits <= 0) {
      router.push('/koupit')
      return
    }
    const newCredits = credits - 1
    setCredits(newCredits)
    localStorage.setItem('docmind_credits', newCredits.toString())
    setLoading(true)
    setResult('')
    setAnswers([])

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: fileContent || DEMO_TEXT, mode }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult(data.result)
      saveToHistory(data.result, fileName, mode)
    } catch (err) {
      setResult('<p style="color:#F09595">Chyba při analýze. Zkus znovu.</p>')
      const restored = credits
      setCredits(restored)
      localStorage.setItem('docmind_credits', restored.toString())
    } finally {
      setLoading(false)
    }
  }

  async function askQuestion() {
    if (!question.trim() || !result) return
    const q = question.trim()
    setQuestion('')
    setQLoading(true)
    setAnswers((prev) => [...prev, { q, a: '...' }])

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: fileContent || DEMO_TEXT, question: q }),
      })
      const data = await res.json()
      setAnswers((prev) =>
        prev.map((item, i) =>
          i === prev.length - 1 ? { ...item, a: data.result || 'Žádná odpověď.' } : item
        )
      )
    } catch {
      setAnswers((prev) =>
        prev.map((item, i) =>
          i === prev.length - 1 ? { ...item, a: 'Chyba odpovědi.' } : item
        )
      )
    } finally {
      setQLoading(false)
    }
  }

  function copyResult() {
    const text = stripHtml(result) + answers.map(a => `\n\nQ: ${a.q}\nA: ${a.a}`).join('')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function exportTxt() {
    const modeLabel = MODES.find(m => m.id === mode)?.label || mode
    const text = [
      `DocMind — ${modeLabel}`,
      `Soubor: ${fileName || 'demo text'}`,
      `Datum: ${new Date().toLocaleDateString('cs-CZ')}`,
      `${'─'.repeat(40)}`,
      stripHtml(result),
      ...answers.map(a => `\nQ: ${a.q}\nA: ${a.a}`)
    ].join('\n')

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `docmind-${modeLabel}-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportPdf() {
    const modeLabel = MODES.find(m => m.id === mode)?.label || mode
    const answersHtml = answers.map(a =>
      `<div style="margin-top:16px;padding:12px;background:#f5f5f5;border-radius:6px">
        <strong style="color:#7F77DD">Q: ${a.q}</strong><br>${a.a}
      </div>`
    ).join('')

    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>DocMind — ${modeLabel}</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 700px; margin: 40px auto; color: #1a1a1a; line-height: 1.7; }
          .header { border-bottom: 2px solid #7F77DD; padding-bottom: 12px; margin-bottom: 24px; }
          .logo { color: #7F77DD; font-size: 20px; font-weight: bold; }
          .meta { color: #888; font-size: 13px; margin-top: 4px; }
          h4 { color: #534AB7; margin: 16px 0 6px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">● docmind</div>
          <div class="meta">${modeLabel} · ${fileName || 'demo text'} · ${new Date().toLocaleDateString('cs-CZ')}</div>
        </div>
        ${result}
        ${answersHtml}
      </body>
      </html>
    `)
    win.document.close()
    setTimeout(() => { win.print(); win.close() }, 500)
  }

  const currentModeLabel = MODES.find(m => m.id === mode)?.label || ''

  return (
    <div className={styles.wrap}>
      <nav className={styles.nav}>
        <div className={styles.logo}>
          <div className={styles.logoDot} />
          docmind
        </div>
        <div className={styles.navRight}>
          <div className={styles.credits}>
            <span className={styles.creditsN}>{credits}</span> kredity
          </div>
          <button className={styles.buyBtn} onClick={() => router.push('/koupit')}>Koupit kredity</button>
        </div>
      </nav>

      <div className={styles.main}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarLabel}>Režim analýzy</div>
          {MODES.map((m) => (
            <button
              key={m.id}
              className={`${styles.modeBtn} ${mode === m.id ? styles.modeBtnActive : ''}`}
              onClick={() => setMode(m.id)}
            >
              <span className={styles.modeIcon}>{m.icon}</span>
              {m.label}
            </button>
          ))}

          {history.length > 0 && (
            <>
              <div className={styles.sidebarLabel} style={{ marginTop: 24 }}>Historie</div>
              {history.map((item) => (
                <button
                  key={item.id}
                  className={styles.historyItem}
                  onClick={() => loadFromHistory(item)}
                  title={item.fileName}
                >
                  <span className={styles.historyName}>{item.fileName}</span>
                  <span className={styles.historyMeta}>{item.date}</span>
                </button>
              ))}
            </>
          )}

          {history.length === 0 && (
            <>
              <div className={styles.sidebarLabel} style={{ marginTop: 24 }}>Historie</div>
              <div className={styles.recentEmpty}>žádné dokumenty</div>
            </>
          )}
        </aside>

        <div className={styles.content}>
          <div
            className={`${styles.upload} ${dragging ? styles.uploadDrag : ''}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDrop={onDrop}
            onDragLeave={() => setDragging(false)}
          >
            <div className={styles.uploadIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7F77DD" strokeWidth="1.5" strokeLinecap="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
            </div>
            <div className={styles.uploadTitle}>Přetáhni nebo klikni pro nahrání</div>
            <div className={styles.uploadSub}>PDF · Word · TXT &nbsp;·&nbsp; max 10 MB</div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              style={{ display: 'none' }}
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>

          {fileName && (
            <div className={styles.fileBar}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7F77DD" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <span className={styles.fileName}>{fileName}</span>
              <span className={styles.fileSize}>{fileSize}</span>
              <button className={styles.fileRemove} onClick={() => { setFileName(''); setFileContent('') }}>×</button>
            </div>
          )}

          <button className={styles.analyzeBtn} onClick={analyze} disabled={loading}>
            {loading ? (
              <span className={styles.loadingDots}><span /><span /><span /></span>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                Analyzovat dokument
              </>
            )}
          </button>

          {(result || loading) && (
            <div className={styles.resultBox}>
              <div className={styles.resultHeader}>
                <span className={styles.resultLabel}>{currentModeLabel}</span>
                <div className={styles.resultActions}>
                  {result && !loading && (
                    <>
                      <button className={styles.actionBtn} onClick={copyResult}>
                        {copied ? '✓ Zkopírováno' : 'Kopírovat'}
                      </button>
                      <button className={styles.actionBtn} onClick={exportTxt}>
                        TXT
                      </button>
                      <button className={styles.actionBtn} onClick={exportPdf}>
                        PDF
                      </button>
                    </>
                  )}
                  <span className={styles.resultMeta}>{fileName || 'demo text'}</span>
                </div>
              </div>

              <div className={styles.resultBody}>
                {loading ? (
                  <div className={styles.loadingRow}>
                    <div className={styles.dot} /><div className={styles.dot} /><div className={styles.dot} />
                    <span>Analyzuji dokument...</span>
                  </div>
                ) : (
                  <div dangerouslySetInnerHTML={{ __html: result }} />
                )}

                {answers.map((a, i) => (
                  <div key={i} className={styles.answerCard}>
                    <p className={styles.answerQ}>{a.q}</p>
                    <p className={styles.answerA}>{a.a === '...' ? (
                      <span style={{ color: '#555' }}>načítám...</span>
                    ) : a.a}</p>
                  </div>
                ))}
              </div>

              {result && !loading && (
                <div className={styles.questionBar}>
                  <input
                    className={styles.questionInput}
                    placeholder="Zeptej se na cokoliv v dokumentu..."
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !qLoading && askQuestion()}
                    disabled={qLoading}
                  />
                  <button className={styles.questionBtn} onClick={askQuestion} disabled={qLoading}>
                    {qLoading ? '...' : 'Zeptat se →'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
