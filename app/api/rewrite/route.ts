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
      body: JSON.stringify({
        model: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
        max_tokens: 2048,
        messages,
      }),
      signal: controller.signal,
    })
  } catch (err: any) {
    clearTimeout(timer)
    if (err.name === 'AbortError') throw new Error('Časový limit vypršel. Zkus znovu.')
    if (attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, 1000 * attempt))
      return callOpenRouter(messages, apiKey, attempt + 1)
    }
    throw new Error('Nepodařilo se spojit s AI serverem.')
  }
  clearTimeout(timer)

  if (response.status === 429) {
    if (attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, 2000 * attempt))
      return callOpenRouter(messages, apiKey, attempt + 1)
    }
    throw new Error('Překročen limit požadavků. Zkus za chvíli.')
  }

  if (!response.ok) {
    const data = await response.json()
    throw new Error(data.error?.message || `Chyba serveru (${response.status})`)
  }

  const data = await response.json()
  let result: string = data.choices?.[0]?.message?.content ?? ''
  result = result.replace(/```html/gi, '').replace(/```/g, '').trim()
  if (!result) throw new Error('AI vrátilo prázdnou odpověď.')
  return result
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Chybí OPENROUTER_API_KEY' }, { status: 500 })

  const { content, style } = await req.json()
  if (!content) return NextResponse.json({ error: 'Chybí obsah dokumentu.' }, { status: 400 })

  const stylePrompts: Record<string, string> = {
    formal: 'Přepiš tento text do formálního, profesionálního jazyka vhodného pro obchodní komunikaci a úřední dokumenty. Zachovej všechny informace, pouze změň styl a tón.',
    simple: 'Přepiš tento text do jednoduchého, srozumitelného jazyka. Odstraň složitá slova a dlouhá souvětí. Zachovej všechny informace.',
  }

  const prompt = stylePrompts[style] || stylePrompts.formal

  try {
    const result = await callOpenRouter([
      { role: 'system', content: 'Jsi profesionální editor textů. Přepisuješ texty podle zadaného stylu. Vrať pouze přepsaný text, bez komentářů.' },
      { role: 'user', content: `${prompt}\n\nTEXT:\n${content.slice(0, 4000)}` },
    ], apiKey)
    return NextResponse.json({ result })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 502 })
  }
}
