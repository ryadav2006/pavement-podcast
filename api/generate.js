const SCRAPE_SOURCES = [
  { name: "OpenAI News", url: "https://openai.com/blog/rss.xml", type: "rss" },
  { name: "Anthropic News", url: "https://www.anthropic.com/news", type: "html" },
  { name: "Google Gemini Blog", url: "https://blog.google/products-and-platforms/products/gemini/", type: "html" },
  { name: "TechCrunch AI", url: "https://techcrunch.com/tag/artificial-intelligence/", type: "html" },
  { name: "MIT Tech Review", url: "https://www.technologyreview.com/topic/artificial-intelligence/", type: "html" },
  { name: "The Verge AI", url: "https://www.theverge.com/ai-artificial-intelligence", type: "html" },
  { name: "Ben Evans", url: "https://www.ben-evans.com/benedictevans", type: "html" },
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
  // Extract titles and descriptions from RSS
  const items = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi
  let match
  let count = 0
  while ((match = itemRegex.exec(xml)) !== null && count < 8) {
    const item = match[1]
    const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || 
                   item.match(/<title>(.*?)<\/title>/))?.[1] || ''
    const desc = (item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || 
                  item.match(/<description>(.*?)<\/description>/))?.[1] || ''
    const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || ''
    if (title) {
      items.push(`- ${title}${pubDate ? ` (${pubDate})` : ''}${desc ? ': ' + desc.replace(/<[^>]+>/g, '').substring(0, 200) : ''}`)
      count++
    }
  }
  return items.length > 0 ? `Recent posts from ${sourceName}:\n${items.join('\n')}` : null
}

function extractHTML(html, sourceName) {
  // Remove noise
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')

  // Try to extract headlines specifically - look for h1, h2, h3 and article titles
  const headlines = []
  const headlineRegex = /<h[123][^>]*>([\s\S]*?)<\/h[123]>/gi
  let match
  let count = 0
  while ((match = headlineRegex.exec(text)) !== null && count < 10) {
    const headline = match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    if (headline.length > 15 && headline.length < 200) {
      headlines.push(`- ${headline}`)
      count++
    }
  }

  // Also grab article tags content
  const articles = []
  const articleRegex = /<article[^>]*>([\s\S]*?)<\/article>/gi
  count = 0
  while ((match = articleRegex.exec(text)) !== null && count < 5) {
    const article = match[1]
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 300)
    if (article.length > 50) {
      articles.push(article)
      count++
    }
  }

  if (headlines.length > 0) {
    return `Recent headlines from ${sourceName}:\n${headlines.join('\n')}${articles.length > 0 ? '\n\nArticle excerpts:\n' + articles.join('\n') : ''}`
  }

  // Fallback: plain text
  const plain = text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 2000)
  
  return plain.length > 100 ? plain : null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { sources, gmailSources, adhocItems, tone } = req.body

  // Scrape all sources in parallel
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

LIVE SCRAPED CONTENT — THIS IS THE ONLY SOURCE OF TRUTH:
${scrapedContent || 'No content was successfully scraped today.'}

${adhocList ? `AD HOC ITEMS ADDED BY USER:\n${adhocList}` : ''}

${failedSources.length > 0 ? `SOURCES THAT FAILED TO SCRAPE (do not reference these): ${failedSources.join(', ')}` : ''}

CRITICAL INSTRUCTIONS:
- You MUST only discuss stories, announcements, and developments that are explicitly present in the scraped content above
- Do NOT invent, extrapolate, or reference any story not directly supported by the content above
- Do NOT use your training data to fill gaps — if there is not enough real content for 5 stories, cover 3 or 4 instead
- If a source failed to scrape, do not reference it or guess what it might contain
- Every claim must be traceable to the scraped content provided

TONE: ${tone}

FORMAT RULES:
- Open with a single punchy sentence — no "welcome" or "hello"
- Cover only stories drawn directly from the scraped content above
- For each story: state what happened (from the content), then your editorial "here's why it matters" take
- End with a 2-sentence forward-looking close
- Write as natural spoken word — short sentences, no bullet points, no markdown
- Target 350-450 words
- No headers, no asterisks — pure spoken script

After the script write exactly:
---NOTEBOOKLM---
Rewrite the same briefing for NotebookLM: add source attributions in brackets after each claim, add a one-sentence context note at the top for ${today}. Same editorial voice.`

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
