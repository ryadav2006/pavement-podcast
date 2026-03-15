const SCRAPE_SOURCES = [
  { name: "OpenAI News", url: "https://openai.com/news" },
  { name: "Anthropic News", url: "https://www.anthropic.com/news" },
  { name: "Google Gemini Blog", url: "https://blog.google/products-and-platforms/products/gemini/" },
  { name: "TechCrunch AI", url: "https://techcrunch.com/tag/artificial-intelligence/" },
  { name: "MIT Tech Review", url: "https://www.technologyreview.com/topic/artificial-intelligence/" },
  { name: "The Verge AI", url: "https://www.theverge.com/ai-artificial-intelligence" },
  { name: "Ben Evans", url: "https://www.ben-evans.com/benedictevans" },
]

async function scrapeSource(source) {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PavementPodcast/1.0)' }
    })
    clearTimeout(timeout)
    if (!res.ok) return { name: source.name, content: null }
    const html = await res.text()
    const content = extractText(html, source.name)
    return { name: source.name, content }
  } catch {
    return { name: source.name, content: null }
  }
}

function extractText(html, sourceName) {
  // Strip scripts, styles, nav, footer
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  
  // Truncate to ~2000 chars to keep token usage reasonable
  return text.substring(0, 2000)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { sources, gmailSources, adhocItems, tone } = req.body

  // Determine which sources to scrape based on what's active
  const activeSources = sources.filter(s => s.on)
  const sourcesToScrape = SCRAPE_SOURCES.filter(s =>
    activeSources.some(a => s.url.includes(a.url) || a.url.includes(s.name.toLowerCase().replace(/\s/g, '')))
  )

  // Scrape all active sources in parallel
  const scraped = await Promise.all(
    SCRAPE_SOURCES.filter(s =>
      activeSources.some(a => s.name.toLowerCase().includes(a.name.toLowerCase().split(' ')[0].toLowerCase()))
    ).map(scrapeSource)
  )

  const scrapedContent = scraped
    .filter(s => s.content)
    .map(s => `=== ${s.name} ===\n${s.content}`)
    .join('\n\n')

  const failedSources = scraped
    .filter(s => !s.content)
    .map(s => s.name)

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

LIVE SCRAPED CONTENT FROM WEB SOURCES:
${scrapedContent || 'No web content available today.'}

${failedSources.length > 0 ? `NOTE: These sources could not be scraped today: ${failedSources.join(', ')}` : ''}

GMAIL NEWSLETTERS CONFIGURED (not yet connected — coming soon):
${gmailList || 'None'}

AD HOC ITEMS ADDED TODAY:
${adhocList || 'None'}

TASK:
Write a spoken editorial briefing script based ONLY on the actual content provided above. Do not invent stories or reference events not present in the scraped content. If a source had no content, skip it. Focus on what's real and current.

TONE: ${tone}

FORMAT RULES:
- Open with a single punchy sentence — no "welcome" or "hello"
- Cover 4-5 distinct stories drawn from the actual scraped content
- For each: state what happened, then deliver a clear "here's why it matters" take
- End with a 2-sentence forward-looking close
- Write as natural spoken word — short sentences, no bullet points, no markdown
- Target 400-450 words (about 3 minutes spoken)
- No headers, no asterisks, no formatting — pure spoken script
- If there is not enough real content to fill 4-5 stories, cover fewer stories rather than inventing content

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
      notebooklm: parts[1]?.trim() || fullText,
      scraped: scraped.map(s => ({ name: s.name, success: !!s.content }))
    })

  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
