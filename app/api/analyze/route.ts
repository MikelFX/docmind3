import { NextRequest, NextResponse } from 'next/server'

type Mode = 'summary' | 'actions' | 'risks' | 'qa'

const PROMPTS: Record<Mode, string> = {
  summary: `Analyzuj dokument a vrať strukturované shrnutí v češtině jako HTML.
Použij <h4 style="color:#AFA9EC;margin:0 0 8px;font-size:13px;font-weight:500"> pro nadpisy
a <p style="margin:0 0 12px;color:#c8c4e8;font-size:13px;line-height:1.8"> pro odstavce.
Žádný markdown, žádné backticky. Vrať POUZE HTML.`,

  actions: `Najdi akční body a úkoly v dokumentu. Vrať jako HTML seznam.
Každá položka: <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px">
<span style="display:inline-block;padding:2px 9px;border-radius:20px;font-size:11px;background:#1a2e1a;color:#5DCAA5;flex-shrink:0">akce</span>
<span style="font-size:13px;color:#c8c4e8;line-height:1.7">popis úkolu</span></div>
Česky. Vrať POUZE HTML fragmenty, žádný markdown.`,

  risks: `Identifikuj rizika a problémy v dokumentu.
Každé riziko: <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px">
<span style="display:inline-block;padding:2px 9px;border-radius:20px;font-size:11px;background:#2e1a1a;color:#F09595;flex-shrink:0">riziko</span>
<span style="font-size:13px;color:#c8c4e8;line-height:1.7">popis rizika</span></div>
Česky. Vrať POUZE HTML fragmenty, žádný markdown.`,

  qa: `Vygeneruj 5 klíčových otázek a odpovědí z dokumentu.
Formát: <div style="margin-bottom:16px;padding:12px;background:#13111f;border-radius:8px;border:0.5px solid #2a2640">
<p style="font-size:12px;color:#7F77DD;margin:0 0 6px;font-weight:500">Otázka?</p>
<p style="font-size:13px;color:#c8c4e8;margin:0;line-height:1.7">Odpověď...</p></div>
Česky. Vrať POUZE HTML fragmenty, žádný markdown.`,
}

const TIMEOUT_MS = 30_000
const MAX_RETRIES = 3

async function callOpenRouter(body: object, apiKey: string, attempt = 1): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'DocMind',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (err: any) {
    clearTimeout(timer)
    if (err.name === 'AbortError') {
      throw new Error('Časový limit vypršel (30s). Zkus to znovu.')
    }
    if (attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, 1000 * attempt))
      return callOpenRouter(body, apiKey, attempt + 1)
    }
    throw new Error('Nepodařilo se spojit s AI serverem.')
  }
  clearTimeout(timer)

  const data = await response.json()

  if (response.status === 429) {
    if (attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, 2000 * attempt))
      return callOpenRouter(body, apiKey, attempt + 1)
    }
    throw new Error('Překročen limit požadavků. Počkej chvíli a zkus znovu.')
  }

  if (response.status === 401) {
    throw new Error('Neplatný API klíč. Zkontroluj OPENROUTER_API_KEY.')
  }

  if (!response.ok) {
    const msg = data.error?.message || `Chyba serveru (${response.status})`
    if (attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, 1000 * attempt))
      return callOpenRouter(body, apiKey, attempt + 1)
    }
    throw new Error(msg)
  }

  let result: string = data.choices?.[0]?.message?.content ?? ''
  result = result.replace(/```html/gi, '').replace(/```/g, '').trim()

  if (!result) throw new Error('AI vrátilo prázdnou odpověď. Zkus znovu.')

  return result
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Chybí OPENROUTER_API_KEY v .env.local' }, { status: 500 })
  }

  let body: { content?: string; mode?: string; question?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Neplatný požadavek.' }, { status: 400 })
  }

  const { content, mode, question } = body
  if (!content) {
    return NextResponse.json({ error: 'Chybí obsah dokumentu.' }, { status: 400 })
  }

  const systemPrompt = question
    ? 'Jsi analytický asistent. Odpovídáš stručně a věcně česky.'
    : 'Jsi analytický asistent. Odpovídáš POUZE jako HTML fragmenty. Žádný markdown, žádné backticky, žádný DOCTYPE.'

  const userMessage = question
    ? `Na základě dokumentu odpověz na: "${question}"\n\nDOKUMENT:\n${content.slice(0, 2000)}\n\nOdpověz stručně česky.`
    : PROMPTS[(mode as Mode) ?? 'summary'] + '\n\nDOKUMENT:\n' + content.slice(0, 3000)

  const requestBody = {
    model: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    max_tokens: 1024,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
  }

  try {
    const result = await callOpenRouter(requestBody, apiKey)
    return NextResponse.json({ result })
  } catch (err: any) {
    console.error('[DocMind] API error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 502 })
  }
}
