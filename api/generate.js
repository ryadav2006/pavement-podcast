export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { sources, gmailSources, adhocItems, tone } = req.body

  const sourceList = sources
    .filter(s => s.on)
    .map(s => `- ${s.name} (${s.url})`)
    .join('\n')

  const gmailList = gmailSources
    .filter(s => s.on)
    .map(s => `- ${s.name}`)
    .join('\n')

  const adhocList = adhocItems
    .map(s => `- ${s.label}: ${s.content}`)
    .join('\n')

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  })

  const prompt = `You are the editorial AI behind "Pavement Podcast" — a sharp, opinionated daily briefing for tech and business executives.

TODAY: ${today}

ACTIVE WEB SOURCES:
${sourceList || 'None'}

ACTIVE GMAIL NEWSLETTERS:
${gmailList || 'None'}

AD HOC ITEMS:
${adhocList || 'None'}

TASK:
Write a spoken editorial briefing script covering the most important developments in AI and tech today. Draw on your knowledge of what these specific publications and newsletters typically cover and their recent reporting beats.

TONE: ${tone}

FORMAT RULES:
- Open with a single punchy sentence — no "welcome" or "hello"
- Cover 4-5 distinct stories or themes
- For each: state what happened, then deliver a clear "here's why it matters" take
- End with a 2-sentence forward-looking close
- Write as natural spoken word — short sentences, no bullet points, no markdown
- Target 400-450 words (about 3 minutes spoken)
- No headers, no asterisks, no formatting — pure spoken script

Then after the script, on a new line write exactly:
---NOTEBOOKLM---
And rewrite the same briefing optimized for NotebookLM input: add source attributions in brackets, structure it with clear topic breaks, and add a one-sentence context note at the top explaining this is an AI news briefing for ${today}. Keep the same editorial voice.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(500).json({ error: data.error?.message || 'Claude API error' })
    }

    const fullText = data.content[0].text
    const parts = fullText.split('---NOTEBOOKLM---')

    return res.status(200).json({
      brief: parts[0].trim(),
      notebooklm: parts[1]?.trim() || fullText
    })

  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
