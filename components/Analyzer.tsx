'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import styles from './Analyzer.module.css'

type Mode = 'summary' | 'actions' | 'risks' | 'qa' | 'rewrite' | 'translate' | 'template' | 'interview'

interface HistoryItem {
  id: string
  fileName: string
  mode: Mode
  result: string
  date: string
}

interface ChatMsg { role: 'ai' | 'user'; text: string }

const MODES: { id: Mode; label: string; icon: string; credits: number; group: 'analyze' | 'tools' }[] = [
  { id: 'summary',   label: 'Shrnutí',           icon: '📋', credits: 1, group: 'analyze' },
  { id: 'actions',   label: 'Akční body',         icon: '✅', credits: 1, group: 'analyze' },
  { id: 'risks',     label: 'Rizika',             icon: '⚠️', credits: 1, group: 'analyze' },
  { id: 'qa',        label: 'Q & A',              icon: '💬', credits: 1, group: 'analyze' },
  { id: 'rewrite',   label: 'Přepisovač',         icon: '✍️', credits: 2, group: 'tools' },
  { id: 'translate', label: 'Překladač',          icon: '🌍', credits: 2, group: 'tools' },
  { id: 'template',  label: 'Generátor šablon',   icon: '📝', credits: 2, group: 'tools' },
  { id: 'interview', label: 'AI Tazatel',         icon: '🤖', credits: 5, group: 'tools' },
]

const DEMO_TEXT = `DocMind Demo: Toto je ukázkový analytický dokument.
Projekt: Implementace CRM systému Q3 2025.
Zodpovědná osoba: Jana Nováková (PM), deadline 15.9.2025.
Úkoly: dokončit API integraci, otestovat import dat, školení týmu.
Rizika: závislost na externím dodavateli, možné zpoždění o 2-3 týdny.
Rozpočet: 450 000 Kč, aktuálně proinvestováno 280 000 Kč.
Závěr: projekt je v plánu, nutné sledovat rizika dodavatele.`

const TRANSLATE_LANGS = [
  { code: 'en', label: '🇬🇧 Angličtina' },
  { code: 'de', label: '🇩🇪 Němčina' },
  { code: 'sk', label: '🇸🇰 Slovenština' },
  { code: 'pl', label: '🇵🇱 Polština' },
  { code: 'fr', label: '🇫🇷 Francouzština' },
  { code: 'es', label: '🇪🇸 Španělština' },
  { code: 'cs', label: '🇨🇿 Čeština' },
]

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
  const [credits, setCredits] = useState(10)
  const [question, setQuestion] = useState('')
  const [qLoading, setQLoading] = useState(false)
  const [answers, setAnswers] = useState<{ q: string; a: string }[]>([])
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [copied, setCopied] = useState(false)

  // Rewrite
  const [rewriteStyle, setRewriteStyle] = useState<'formal' | 'simple'>('formal')

  // Translate
  const [targetLang, setTargetLang] = useState('en')

  // Template
  const [templateDesc, setTemplateDesc] = useState('')
  const [templateLang, setTemplateLang] = useState('cs')

  // Interview
  const [interviewType, setInterviewType] = useState('')
  const [interviewStarted, setInterviewStarted] = useState(false)
  const [interviewChat, setInterviewChat] = useState<ChatMsg[]>([])
  const [interviewHistory, setInterviewHistory] = useState<{ role: string; content: string }[]>([])
  const [interviewInput, setInterviewInput] = useState('')
  const [interviewDoc, setInterviewDoc] = useState('')
  const [interviewLoading, setInterviewLoading] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    const saved = localStorage.getItem('docmind_history')
    if (saved) setHistory(JSON.parse(saved))
    const savedCredits = localStorage.getItem('docmind_credits')
    if (savedCredits) setCredits(parseInt(savedCredits))
  }, [])

  function saveCredits(n: number) {
    setCredits(n)
    localStorage.setItem('docmind_credits', n.toString())
  }

  function useCredits(cost: number): boolean {
    if (credits < cost) { router.push('/koupit'); return false }
    saveCredits(credits - cost)
    return true
  }

  function restoreCredits(cost: number) {
    saveCredits(credits + cost)
  }

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

  async function handleFile(file: File) {
    setFileName(file.name)
    const kb = Math.round(file.size / 1024)
    setFileSize(kb > 1024 ? (kb / 1024).toFixed(1) + ' MB' : kb + ' KB')

    if (file.name.toLowerCase().endsWith('.pdf')) {
      try {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`
        const arrayBuffer = await file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        let fullText = ''
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const textContent = await page.getTextContent()
          const pageText = textContent.items.map((item: any) => ('str' in item ? item.str : '')).join(' ')
          fullText += pageText + '\n'
        }
        setFileContent(fullText.trim() || 'PDF neobsahuje čitelný text.')
      } catch {
        setFileContent('Nepodařilo se načíst PDF.')
      }
    } else {
      const reader = new FileReader()
      reader.onload = (e) => setFileContent(e.target?.result as string)
      reader.readAsText(file)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const currentMode = MODES.find(m => m.id === mode)!
  const needsFile = ['summary', 'actions', 'risks', 'qa', 'rewrite', 'translate'].includes(mode)

  // ── ANALYZE ──
  async function analyze() {
    const cost = currentMode.credits
    if (!useCredits(cost)) return
    setLoading(true)
    setResult('')
    setAnswers([])

    try {
      let res: Response
      const content = fileContent || DEMO_TEXT

      if (mode === 'rewrite') {
        res = await fetch('/api/rewrite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, style: rewriteStyle }),
        })
      } else if (mode === 'translate') {
        res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, targetLang }),
        })
      } else {
        res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, mode }),
        })
      }

      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult(data.result)
      saveToHistory(data.result, fileName, mode)
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Chyba. Zkus znovu.'
      setResult(`<p style="color:#F09595;font-size:13px">${msg}</p>`)
      restoreCredits(cost)
    } finally {
      setLoading(false)
    }
  }

  // ── TEMPLATE ──
  async function generateTemplate() {
    if (!templateDesc.trim()) return
    const cost = currentMode.credits
    if (!useCredits(cost)) return
    setLoading(true)
    setResult('')
    try {
      const res = await fetch('/api/template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: templateDesc, language: templateLang }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult(data.result)
      saveToHistory(data.result, templateDesc.slice(0, 30), mode)
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Chyba. Zkus znovu.'
      setResult(`<p style="color:#F09595;font-size:13px">${msg}</p>`)
      restoreCredits(cost)
    } finally {
      setLoading(false)
    }
  }

  // ── INTERVIEW ──
  async function startInterview() {
    if (!interviewType.trim()) return
    const cost = currentMode.credits
    if (!useCredits(cost)) return
    setInterviewLoading(true)
    setInterviewStarted(true)
    setInterviewChat([])
    setInterviewHistory([])
    setInterviewDoc('')
    try {
      const res = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docType: interviewType, history: [], userAnswer: null }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      if (data.question) {
        setInterviewChat([{ role: 'ai', text: data.question }])
        setInterviewHistory([{ role: 'assistant', content: data.question }])
      }
    } catch (err: any) {
      setInterviewChat([{ role: 'ai', text: 'Chyba: ' + (err.message || 'Zkus znovu.') }])
      restoreCredits(cost)
    } finally {
      setInterviewLoading(false)
    }
  }

  async function sendInterviewAnswer() {
    if (!interviewInput.trim() || interviewLoading) return
    const answer = interviewInput.trim()
    setInterviewInput('')
    const newChat: ChatMsg[] = [...interviewChat, { role: 'user', text: answer }]
    setInterviewChat(newChat)
    const newHistory = [...interviewHistory, { role: 'user', content: answer }]
    setInterviewLoading(true)
    try {
      const res = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docType: interviewType, history: newHistory }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      if (data.isFinished && data.document) {
        setInterviewDoc(data.document)
        setInterviewChat([...newChat, { role: 'ai', text: '✅ Dokument je hotov! Viz výsledek níže.' }])
        saveToHistory(data.document, interviewType, mode)
      } else if (data.question) {
        setInterviewChat([...newChat, { role: 'ai', text: data.question }])
        setInterviewHistory([...newHistory, { role: 'assistant', content: data.question }])
      }
    } catch (err: any) {
      setInterviewChat([...newChat, { role: 'ai', text: 'Chyba: ' + (err.message || 'Zkus znovu.') }])
    } finally {
      setInterviewLoading(false)
    }
  }

  // ── Q&A follow-up ──
  async function askQuestion() {
    if (!question.trim() || !result) return
    const q = question.trim()
    setQuestion('')
    setQLoading(true)
    setAnswers(prev => [...prev, { q, a: '...' }])
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: fileContent || DEMO_TEXT, question: q }),
      })
      const data = await res.json()
      setAnswers(prev => prev.map((item, i) => i === prev.length - 1 ? { ...item, a: data.result || 'Žádná odpověď.' } : item))
    } catch {
      setAnswers(prev => prev.map((item, i) => i === prev.length - 1 ? { ...item, a: 'Chyba.' } : item))
    } finally {
      setQLoading(false)
    }
  }

  // ── EXPORT ──
  function copyResult() {
    const text = mode === 'interview' && interviewDoc ? interviewDoc : stripHtml(result) + answers.map(a => `\n\nQ: ${a.q}\nA: ${a.a}`).join('')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function exportTxt() {
    const text = mode === 'interview' && interviewDoc ? interviewDoc : stripHtml(result)
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `docmind-${mode}-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportPdf() {
    const content = mode === 'interview' && interviewDoc
      ? `<pre style="white-space:pre-wrap;font-family:Arial">${interviewDoc}</pre>`
      : result
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>DocMind</title>
      <style>body{font-family:Arial,sans-serif;max-width:700px;margin:40px auto;color:#1a1a1a;line-height:1.7}
      .header{border-bottom:2px solid #7F77DD;padding-bottom:12px;margin-bottom:24px}
      .logo{color:#7F77DD;font-size:20px;font-weight:bold}
      .meta{color:#888;font-size:13px;margin-top:4px}h4{color:#534AB7}</style>
      </head><body>
      <div class="header"><div class="logo">● docmind</div>
      <div class="meta">${currentMode.label} · ${fileName || 'demo'} · ${new Date().toLocaleDateString('cs-CZ')}</div></div>
      ${content}</body></html>`)
    win.document.close()
    setTimeout(() => { win.print(); win.close() }, 500)
  }

  const hasResult = result || (mode === 'interview' && interviewDoc)
  const showUpload = needsFile
  const showAnalyzeBtn = ['summary', 'actions', 'risks', 'qa', 'rewrite', 'translate'].includes(mode)

  return (
    <div className={styles.wrap}>
      <nav className={styles.nav}>
        <div className={styles.logo}><div className={styles.logoDot} />docmind</div>
        <div className={styles.navRight}>
          <div className={styles.credits}>
            <span className={styles.creditsN}>{credits}</span> kredity
          </div>
          <button className={styles.buyBtn} onClick={() => router.push('/koupit')}>Koupit kredity</button>
        </div>
      </nav>

      <div className={styles.main}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarLabel}>Analýza dokumentu</div>
          {MODES.filter(m => m.group === 'analyze').map(m => (
            <button key={m.id} className={`${styles.modeBtn} ${mode === m.id ? styles.modeBtnActive : ''}`} onClick={() => { setMode(m.id); setResult(''); setAnswers([]) }}>
              <span className={styles.modeIcon}>{m.icon}</span>
              <span className={styles.modeLabelText}>{m.label}</span>
              <span className={styles.modeCredits}>{m.credits}k</span>
            </button>
          ))}

          <div className={styles.sidebarLabel} style={{ marginTop: 16 }}>Nástroje AI</div>
          {MODES.filter(m => m.group === 'tools').map(m => (
            <button key={m.id} className={`${styles.modeBtn} ${mode === m.id ? styles.modeBtnActive : ''}`} onClick={() => { setMode(m.id); setResult(''); setAnswers([]); setInterviewStarted(false) }}>
              <span className={styles.modeIcon}>{m.icon}</span>
              <span className={styles.modeLabelText}>{m.label}</span>
              <span className={styles.modeCredits}>{m.credits}k</span>
            </button>
          ))}

          {history.length > 0 && (
            <>
              <div className={styles.sidebarLabel} style={{ marginTop: 16 }}>Historie</div>
              {history.map(item => (
                <button key={item.id} className={styles.historyItem} onClick={() => { setResult(item.result); setMode(item.mode); setFileName(item.fileName); setAnswers([]) }} title={item.fileName}>
                  <span className={styles.historyName}>{item.fileName}</span>
                  <span className={styles.historyMeta}>{item.date}</span>
                </button>
              ))}
            </>
          )}
        </aside>

        <div className={styles.content}>
          {/* UPLOAD */}
          {showUpload && (
            <>
              <div className={`${styles.upload} ${dragging ? styles.uploadDrag : ''}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDrop={onDrop}
                onDragLeave={() => setDragging(false)}>
                <div className={styles.uploadIcon}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7F77DD" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
                  </svg>
                </div>
                <div className={styles.uploadTitle}>Přetáhni nebo klikni pro nahrání</div>
                <div className={styles.uploadSub}>PDF · Word · TXT · max 10 MB</div>
                <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
              </div>
              {fileName && (
                <div className={styles.fileBar}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7F77DD" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <span className={styles.fileName}>{fileName}</span>
                  <span className={styles.fileSize}>{fileSize}</span>
                  <button className={styles.fileRemove} onClick={() => { setFileName(''); setFileContent('') }}>×</button>
                </div>
              )}
            </>
          )}

          {/* REWRITE OPTIONS */}
          {mode === 'rewrite' && (
            <div className={styles.optionRow}>
              <span className={styles.optionLabel}>Styl přepisu:</span>
              <button className={`${styles.optionBtn} ${rewriteStyle === 'formal' ? styles.optionBtnActive : ''}`} onClick={() => setRewriteStyle('formal')}>Formálnější</button>
              <button className={`${styles.optionBtn} ${rewriteStyle === 'simple' ? styles.optionBtnActive : ''}`} onClick={() => setRewriteStyle('simple')}>Jednodušší</button>
            </div>
          )}

          {/* TRANSLATE OPTIONS */}
          {mode === 'translate' && (
            <div className={styles.optionRow}>
              <span className={styles.optionLabel}>Přeložit do:</span>
              <select className={styles.selectInput} value={targetLang} onChange={e => setTargetLang(e.target.value)}>
                {TRANSLATE_LANGS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </div>
          )}

          {/* TEMPLATE */}
          {mode === 'template' && (
            <div className={styles.toolCard}>
              <div className={styles.toolCardTitle}>📝 Generátor šablon <span className={styles.creditBadge}>2 kredity</span></div>
              <p className={styles.toolCardDesc}>Popiš jaký dokument potřebuješ a AI ho vygeneruje připravený k použití.</p>
              <textarea
                className={styles.textareaInput}
                placeholder="Např: Smlouva o dílo mezi OSVČ a firmou, předmět díla je vývoj webu, cena 50 000 Kč, doba plnění 2 měsíce..."
                value={templateDesc}
                onChange={e => setTemplateDesc(e.target.value)}
                rows={4}
              />
              <div className={styles.optionRow}>
                <span className={styles.optionLabel}>Jazyk dokumentu:</span>
                <button className={`${styles.optionBtn} ${templateLang === 'cs' ? styles.optionBtnActive : ''}`} onClick={() => setTemplateLang('cs')}>🇨🇿 Čeština</button>
                <button className={`${styles.optionBtn} ${templateLang === 'en' ? styles.optionBtnActive : ''}`} onClick={() => setTemplateLang('en')}>🇬🇧 Angličtina</button>
              </div>
              <button className={styles.analyzeBtn} onClick={generateTemplate} disabled={loading || !templateDesc.trim()}>
                {loading ? <span className={styles.loadingDots}><span /><span /><span /></span> : '✨ Vygenerovat dokument'}
              </button>
            </div>
          )}

          {/* INTERVIEW */}
          {mode === 'interview' && !interviewStarted && (
            <div className={styles.toolCard}>
              <div className={styles.toolCardTitle}>🤖 AI Tazatel <span className={styles.creditBadge}>5 kreditů</span></div>
              <p className={styles.toolCardDesc}>AI se tě bude ptát otázkami a na základě odpovědí vytvoří kompletní dokument.</p>
              <input
                className={styles.textInput}
                placeholder="Jaký dokument chceš vytvořit? Např: NDA smlouva, Pracovní smlouva, Obchodní nabídka..."
                value={interviewType}
                onChange={e => setInterviewType(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && startInterview()}
              />
              <button className={styles.analyzeBtn} onClick={startInterview} disabled={interviewLoading || !interviewType.trim()}>
                {interviewLoading ? <span className={styles.loadingDots}><span /><span /><span /></span> : '🚀 Zahájit rozhovor'}
              </button>
            </div>
          )}

          {/* INTERVIEW CHAT */}
          {mode === 'interview' && interviewStarted && (
            <div className={styles.interviewBox}>
              <div className={styles.interviewHeader}>
                <span className={styles.resultLabel}>🤖 AI Tazatel — {interviewType}</span>
                <button className={styles.actionBtn} onClick={() => { setInterviewStarted(false); setInterviewDoc('') }}>Nový</button>
              </div>
              <div className={styles.chatArea}>
                {interviewChat.map((msg, i) => (
                  <div key={i} className={msg.role === 'ai' ? styles.chatAi : styles.chatUser}>
                    {msg.text}
                  </div>
                ))}
                {interviewLoading && (
                  <div className={styles.chatAi}>
                    <div className={styles.loadingRow}><div className={styles.dot} /><div className={styles.dot} /><div className={styles.dot} /></div>
                  </div>
                )}
              </div>
              {!interviewDoc && (
                <div className={styles.questionBar}>
                  <input className={styles.questionInput} placeholder="Tvoje odpověď..." value={interviewInput} onChange={e => setInterviewInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendInterviewAnswer()} disabled={interviewLoading} />
                  <button className={styles.questionBtn} onClick={sendInterviewAnswer} disabled={interviewLoading}>Odeslat →</button>
                </div>
              )}
              {interviewDoc && (
                <div className={styles.interviewResult}>
                  <div className={styles.interviewResultHeader}>
                    <span style={{ color: '#5DCAA5', fontSize: 12 }}>✅ Dokument vygenerován</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className={styles.actionBtn} onClick={copyResult}>{copied ? '✓' : 'Kopírovat'}</button>
                      <button className={styles.actionBtn} onClick={exportTxt}>TXT</button>
                      <button className={styles.actionBtn} onClick={exportPdf}>PDF</button>
                    </div>
                  </div>
                  <pre className={styles.interviewDoc}>{interviewDoc}</pre>
                </div>
              )}
            </div>
          )}

          {/* ANALYZE BUTTON for non-special modes */}
          {showAnalyzeBtn && (
            <button className={styles.analyzeBtn} onClick={analyze} disabled={loading}>
              {loading ? <span className={styles.loadingDots}><span /><span /><span /></span> : (
                <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                {currentMode.label} — {currentMode.credits} {currentMode.credits === 1 ? 'kredit' : 'kredity'}</>
              )}
            </button>
          )}

          {/* RESULT BOX */}
          {(result || loading) && mode !== 'interview' && (
            <div className={styles.resultBox}>
              <div className={styles.resultHeader}>
                <span className={styles.resultLabel}>{currentMode.label}</span>
                <div className={styles.resultActions}>
                  {result && !loading && (
                    <>
                      <button className={styles.actionBtn} onClick={copyResult}>{copied ? '✓ Zkopírováno' : 'Kopírovat'}</button>
                      <button className={styles.actionBtn} onClick={exportTxt}>TXT</button>
                      <button className={styles.actionBtn} onClick={exportPdf}>PDF</button>
                    </>
                  )}
                  <span className={styles.resultMeta}>{fileName || 'demo text'}</span>
                </div>
              </div>
              <div className={styles.resultBody}>
                {loading ? (
                  <div className={styles.loadingRow}><div className={styles.dot} /><div className={styles.dot} /><div className={styles.dot} /><span>Zpracovávám...</span></div>
                ) : mode === 'rewrite' || mode === 'translate' || mode === 'template' ? (
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.8, color: '#c8c4e8' }}>{result}</pre>
                ) : (
                  <div dangerouslySetInnerHTML={{ __html: result }} />
                )}
                {answers.map((a, i) => (
                  <div key={i} className={styles.answerCard}>
                    <p className={styles.answerQ}>{a.q}</p>
                    <p className={styles.answerA}>{a.a === '...' ? <span style={{ color: '#555' }}>načítám...</span> : a.a}</p>
                  </div>
                ))}
              </div>
              {result && !loading && ['summary', 'actions', 'risks', 'qa'].includes(mode) && (
                <div className={styles.questionBar}>
                  <input className={styles.questionInput} placeholder="Zeptej se na cokoliv v dokumentu..." value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => e.key === 'Enter' && !qLoading && askQuestion()} disabled={qLoading} />
                  <button className={styles.questionBtn} onClick={askQuestion} disabled={qLoading}>{qLoading ? '...' : 'Zeptat se →'}</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
