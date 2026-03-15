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
  if (!dateStr) return null // unknown date — let Claude decide
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

  // Extract dates near headlines to tag freshness
  const headlines = []
  const headlineRegex = /<h[123][^>]*>([\s\S]*?)<\/h[123]>/gi
  let match
  let count = 0
  while ((match = headlineRegex.exec(text)) !== null && count < 12) {
    const headline = match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    if (headline.length > 15 && headline.length < 200) {
      // Look for a date in nearby HTML (within 500 chars after headline)
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

  // Article excerpts
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

  const { sources, gmailSources, adhocItems, tone } = req.body

  const scraped = await Promise.all(SCRAPE_SOURCES.map(scrapeSource))

  const successfulScrapes = scraped.filter(s => s.content)
  const failedSources = scraped.filter(s => !s.content).map(s => s.name)

  const scrapedContent = successfulScrapes
    .map(s => `=== ${s.name} ===\n${s.content}`)
    .join('\n\n')

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

LIVE SCRAPED CONTENT — YOUR ONLY SOURCE OF TRUTH:
${scrapedContent || 'No content scraped today.'}

${adhocList ? `AD HOC ITEMS FROM USER:\n${adhocList}\n` : ''}
${failedSources.length > 0 ? `FAILED SOURCES (do not reference): ${failedSources.join(', ')}\n` : ''}

CRITICAL RULES — READ CAREFULLY:
1. Only discuss stories explicitly present in the scraped content above
2. Items tagged [STALE - SKIP] are older than 48 hours — do NOT include them
3. Items tagged [FRESH] are within the last 48 hours — prioritize these
4. Items tagged [DATE UNKNOWN] — use editorial judgment, include only if highly newsworthy
5. Do NOT invent any specific names, numbers, product names, or company announcements not present in the content
6. Do NOT use your training data to fill gaps
7. When referencing a person, use their full name as it appears in the content — never abbreviate or guess
8. If fewer than 3 fresh stories exist, note this is a lighter news day and cover what's available
9. Every factual claim must be directly traceable to the scraped content above

TONE: ${tone}

FORMAT:
- Single punchy opening sentence — no "welcome"
- Cover only [FRESH] and [DATE UNKNOWN] stories
- For each: what happened + why it matters editorially
- If fewer than 3 fresh stories: open with "Lighter news day today —" and cover what's real
- 2-sentence forward-looking close
- Natural spoken word, 350-450 words, no markdown, no bullets

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
