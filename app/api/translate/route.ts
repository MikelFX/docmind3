import { NextRequest, NextResponse } from 'next/server'

const TIMEOUT_MS = 30_000
const MAX_RETRIES = 3

async function callOpenRouter(messages: object[], apiKey: string, attempt = 1): Promise<string> {
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
      body: JSON.stringify({ model: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', max_tokens: 2048, messages }),
      signal: controller.signal,
    })
  } catch (err: any) {
    clearTimeout(timer)
    if (err.name === 'AbortError') throw new Error('Časový limit vypršel. Zkus znovu.')
    if (attempt < MAX_RETRIES) { await new Promise(r => setTimeout(r, 1000 * attempt)); return callOpenRouter(messages, apiKey, attempt + 1) }
    throw new Error('Nepodařilo se spojit s AI serverem.')
  }
  clearTimeout(timer)
  if (response.status === 429) {
    if (attempt < MAX_RETRIES) { await new Promise(r => setTimeout(r, 2000 * attempt)); return callOpenRouter(messages, apiKey, attempt + 1) }
    throw new Error('Překročen limit požadavků.')
  }
  if (!response.ok) { const data = await response.json(); throw new Error(data.error?.message || `Chyba (${response.status})`) }
  const data = await response.json()
  let result: string = data.choices?.[0]?.message?.content ?? ''
  result = result.replace(/```html/gi, '').replace(/```/g, '').trim()
  if (!result) throw new Error('AI vrátilo prázdnou odpověď.')
  return result
}

const LANG_NAMES: Record<string, string> = {
  cs: 'češtiny', en: 'angličtiny', de: 'němčiny', sk: 'slovenštiny', pl: 'polštiny', fr: 'francouzštiny', es: 'španělštiny',
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Chybí OPENROUTER_API_KEY' }, { status: 500 })

  const { content, targetLang } = await req.json()
  if (!content) return NextResponse.json({ error: 'Chybí obsah dokumentu.' }, { status: 400 })

  const langName = LANG_NAMES[targetLang] || targetLang

  try {
    const result = await callOpenRouter([
      { role: 'system', content: 'Jsi profesionální překladatel. Překládáš přesně a zachováváš styl originálu. Vrať pouze přeložený text.' },
      { role: 'user', content: `Přelož tento text do ${langName}. Zachovej formátování a strukturu.\n\nTEXT:\n${content.slice(0, 4000)}` },
    ], apiKey)
    return NextResponse.json({ result })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 502 })
  }
}
