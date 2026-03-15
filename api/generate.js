const SCRAPE_SOURCES = [
  { name: "OpenAI News", url: "https://openai.com/blog/rss.xml", type: "rss" },
  { name: "Anthropic News", url: "https://www.anthropic.com/news", type: "html" },
  { name: "Google Gemini Blog", url: "https://blog.google/products-and-platforms/products/gemini/", type: "html" },
  { name: "TechCrunch AI", url: "https://techcrunch.com/tag/artificial-intelligence/", type: "html" },
  { name: "MIT Tech Review", url: "https://www.technologyreview.com/topic/artificial-intelligence/", type: "html" },
  { name: "The Verge AI", url: "https://www.theverge.com/ai-artificial-intelligence", type: "html" },
  { name: "Ben Evans", url: "https://www.ben-evans.com/benedictevans", type: "html" },
]

const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000

function isRecent(dateStr) {
  if (!dateStr) return null
  const parsed = new Date(dateStr)
  if (isNaN(parsed)) return null
  return (Date.now() - parsed.getTime()) < FORTY_EIGHT_HOURS
}

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
    const text = await res.text()
    const content = source.type === 'rss'
      ? extractRSS(text, source.name)
      : extractHTML(text, source.name)
    return { name: source.name, content }
  } catch {
    return { name: source.name, content: null }
  }
}

function extractRSS(xml, sourceName) {
  const items = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi
  let match
  let count = 0
  while ((match = itemRegex.exec(xml)) !== null && count < 10) {
    const item = match[1]
    const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
                   item.match(/<title>(.*?)<\/title>/))?.[1]?.trim() || ''
    const desc = (item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ||
                  item.match(/<description>([\s\S]*?)<\/description>/))?.[1] || ''
    const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim() || ''
    const recent = isRecent(pubDate)
    if (title) {
      const ageTag = recent === true ? '[FRESH]' : recent === false ? '[STALE - SKIP]' : '[DATE UNKNOWN]'
      const cleanDesc = desc.replace(/<[^>]+>/g, '').substring(0, 200)
      items.push(`${ageTag} ${title}${pubDate ? ` | Published: ${pubDate}` : ''}${cleanDesc ? ' | ' + cleanDesc : ''}`)
      count++
    }
  }
  return items.length > 0 ? `${sourceName}:\n${items.join('\n')}` : null
}

function extractHTML(html, sourceName) {
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')

  const headlines = []
  const headlineRegex = /<h[123][^>]*>([\s\S]*?)<\/h[123]>/gi
  let match
  let count = 0
  while ((match = headlineRegex.exec(text)) !== null && count < 12) {
    const headline = match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    if (headline.length > 15 && headline.length < 200) {
      const nearby = text.substring(match.index, match.index + 500)
      const dateMatch = nearby.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?\s+\d{1,2},?\s+\d{4}\b/i) ||
                        nearby.match(/\b\d{4}-\d{2}-\d{2}\b/) ||
                        nearby.match(/datetime="([^"]+)"/)
      const dateStr = dateMatch?.[1] || dateMatch?.[0] || null
      const recent = isRecent(dateStr)
      const ageTag = recent === true ? '[FRESH]' : recent === false ? '[STALE - SKIP]' : '[DATE UNKNOWN]'
      headlines.push(`${ageTag} ${headline}${dateStr ? ` | ${dateStr}` : ''}`)
      count++
    }
  }

  const articles = []
  const articleRegex = /<article[^>]*>([\s\S]*?)<\/article>/gi
  count = 0
  while ((match = articleRegex.exec(text)) !== null && count < 5) {
    const article = match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 300)
    if (article.length > 50) { articles.push(article); count++ }
  }

  if (headlines.length > 0) {
    return `${sourceName}:\n${headlines.join('\n')}${articles.length > 0 ? '\n\nExcerpts:\n' + articles.join('\n') : ''}`
  }

  const plain = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 2000)
  return plain.length > 100 ? plain : null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { sources, gmailSources, gmailContent, adhocItems, tone } = req.body

  // Scrape web sources in parallel
  const scraped = await Promise.all(SCRAPE_SOURCES.map(scrapeSource))
  const successfulScrapes = scraped.filter(s => s.content)
  const failedSources = scraped.filter(s => !s.content).map(s => s.name)

  const scrapedContent = successfulScrapes
    .map(s => `=== ${s.name} ===\n${s.content}`)
    .join('\n\n')

  // Format Gmail newsletter content
  const gmailContentFormatted = gmailContent && gmailContent.length > 0
    ? gmailContent.map(email =>
        `=== ${email.sender} — "${email.subject}" (${email.date}) ===\n${email.body}`
      ).join('\n\n')
    : null

  const adhocList = adhocItems && adhocItems.length > 0
    ? adhocItems.map(s => `- ${s.label}: ${s.content}`).join('\n')
    : null

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  })

  const prompt = `You are the editorial AI behind "Pavement Podcast" — a sharp, opinionated daily briefing for tech and business executives.

TODAY: ${today}

LIVE SCRAPED WEB CONTENT — PRIMARY SOURCE:
${scrapedContent || 'No web content scraped today.'}

${gmailContentFormatted ? `LIVE GMAIL NEWSLETTER CONTENT — SECONDARY SOURCE:\n${gmailContentFormatted}` : 'GMAIL: Not connected or no recent newsletters found.'}

${adhocList ? `AD HOC ITEMS FROM USER:\n${adhocList}` : ''}

${failedSources.length > 0 ? `FAILED SOURCES (do not reference): ${failedSources.join(', ')}` : ''}

CRITICAL RULES:
1. Only discuss stories explicitly present in the content above
2. Items tagged [STALE - SKIP] are older than 48 hours — do NOT include them
3. Items tagged [FRESH] are within 48 hours — prioritize these
4. Items tagged [DATE UNKNOWN] — include only if highly newsworthy
5. Do NOT invent specific names, numbers, product names, or announcements not in the content
6. Do NOT use training data to fill gaps
7. Always use full names — never abbreviate (e.g. "Pete Hegseth" not "Pete")
8. If fewer than 3 fresh stories exist, open with "Lighter news day today —"
9. Every factual claim must be traceable to the content above
10. Gmail newsletters are real content from today's inbox — treat them as high-signal primary sources

TONE: ${tone}

FORMAT — TARGET 15-20 MINUTES SPOKEN (approximately 2000-2500 words):
- Single punchy opening sentence — no "welcome"
- Cover 8-12 distinct stories or themes drawn from the content
- For each story: what happened (2-3 sentences) + why it matters editorially (3-4 sentences of analysis)
- Group related stories thematically where natural
- End with a 3-4 sentence forward-looking close with your sharpest take
- Natural spoken word — varied sentence length, rhetorical questions welcome, no bullet points, no markdown
- If lighter news day: cover fewer stories but go deeper on each

After the script write exactly:
---NOTEBOOKLM---
Same briefing for NotebookLM: source attributions in brackets after each claim, context note at top for ${today}, same editorial voice.`

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
        max_tokens: 4000,
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
