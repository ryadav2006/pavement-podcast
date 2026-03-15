const SCRAPE_SOURCES = [
  { name: "OpenAI News", url: "https://openai.com/blog/rss.xml", type: "rss", deep: true },
  { name: "Anthropic News", url: "https://www.anthropic.com/news", type: "html", deep: true },
  { name: "Google Gemini Blog", url: "https://blog.google/products-and-platforms/products/gemini/", type: "html", deep: true },
  { name: "TechCrunch AI", url: "https://techcrunch.com/tag/artificial-intelligence/", type: "html", deep: true },
  { name: "MIT Tech Review", url: "https://www.technologyreview.com/topic/artificial-intelligence/", type: "html", deep: true },
  { name: "The Verge AI", url: "https://www.theverge.com/ai-artificial-intelligence", type: "html", deep: true },
  { name: "Ben Evans", url: "https://www.ben-evans.com/benedictevans", type: "html", deep: true },
]

const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000

function isRecent(dateStr) {
  if (!dateStr) return null
  const parsed = new Date(dateStr)
  if (isNaN(parsed)) return null
  return (Date.now() - parsed.getTime()) < FORTY_EIGHT_HOURS
}

async function fetchWithTimeout(url, timeout = 8000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PavementPodcast/1.0)' }
    })
    clearTimeout(timer)
    return res
  } catch (e) {
    clearTimeout(timer)
    throw e
  }
}

function extractArticleText(html) {
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')

  // Try article tag first
  const articleMatch = text.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
  if (articleMatch) {
    return articleMatch[1]
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 3000)
  }

  // Try main tag
  const mainMatch = text.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
  if (mainMatch) {
    return mainMatch[1]
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 3000)
  }

  // Fallback: strip all tags
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 2000)
}

function extractLinks(html, baseUrl) {
  const links = []
  const linkRegex = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
  let match
  while ((match = linkRegex.exec(html)) !== null) {
    let href = match[1]
    const text = match[2].replace(/<[^>]+>/g, '').trim()

    // Skip non-article links
    if (!href || href.startsWith('#') || href.startsWith('mailto:') ||
        href.includes('twitter.com') || href.includes('facebook.com') ||
        href.includes('login') || href.includes('subscribe') ||
        href.includes('account') || text.length < 10) continue

    // Make absolute
    if (href.startsWith('/')) {
      const base = new URL(baseUrl)
      href = `${base.protocol}//${base.host}${href}`
    } else if (!href.startsWith('http')) {
      continue
    }

    // Only same domain
    try {
      const linkDomain = new URL(href).hostname
      const baseDomain = new URL(baseUrl).hostname
      if (linkDomain !== baseDomain) continue
    } catch { continue }

    links.push({ href, text })
  }
  return links
}

async function deepScrapeSource(source) {
  try {
    // Step 1: fetch the index page
    const res = await fetchWithTimeout(source.url, 10000)
    if (!res.ok) return { name: source.name, content: null }
    const html = await res.text()

    let indexContent = ''
    let articleContents = []

    if (source.type === 'rss') {
      // For RSS: extract items with full descriptions
      const items = []
      const itemRegex = /<item>([\s\S]*?)<\/item>/gi
      let match
      let count = 0
      while ((match = itemRegex.exec(html)) !== null && count < 8) {
        const item = match[1]
        const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
                       item.match(/<title>(.*?)<\/title>/))?.[1]?.trim() || ''
        const desc = (item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ||
                      item.match(/<description>([\s\S]*?)<\/description>/))?.[1] || ''
        const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim() || ''
        const link = item.match(/<link>(.*?)<\/link>/)?.[1]?.trim() || ''
        const recent = isRecent(pubDate)

        if (title) {
          const ageTag = recent === true ? '[FRESH]' : recent === false ? '[STALE - SKIP]' : '[DATE UNKNOWN]'
          const cleanDesc = desc.replace(/<[^>]+>/g, '').substring(0, 500)
          items.push(`${ageTag} ${title} | ${pubDate}\n${cleanDesc}`)
          count++
        }
      }
      return {
        name: source.name,
        content: items.length > 0 ? `${source.name}:\n${items.join('\n\n')}` : null
      }
    }

    // Step 2: extract headlines and links from index
    const headlines = []
    const headlineRegex = /<h[123][^>]*>([\s\S]*?)<\/h[123]>/gi
    let match
    let count = 0
    while ((match = headlineRegex.exec(html)) !== null && count < 15) {
      const headline = match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
      if (headline.length > 15 && headline.length < 200) {
        const nearby = html.substring(match.index, match.index + 500)
        const dateMatch = nearby.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?\s+\d{1,2},?\s+\d{4}\b/i) ||
                          nearby.match(/\b\d{4}-\d{2}-\d{2}\b/) ||
                          nearby.match(/datetime="([^"]+)"/)
        const dateStr = dateMatch?.[1] || dateMatch?.[0] || null
        const recent = isRecent(dateStr)
        const ageTag = recent === true ? '[FRESH]' : recent === false ? '[STALE - SKIP]' : '[DATE UNKNOWN]'
        headlines.push({ text: `${ageTag} ${headline}${dateStr ? ` | ${dateStr}` : ''}`, recent, index: match.index })
        count++
      }
    }

    indexContent = headlines.map(h => h.text).join('\n')

    // Step 3: find fresh article links and deep fetch them
    const links = extractLinks(html, source.url)
    const freshHeadlines = headlines.filter(h => h.recent === true || h.recent === null)

    // Match links to fresh headlines and fetch top 4
    const articleLinks = links
      .filter(l => freshHeadlines.some(h =>
        h.text.toLowerCase().includes(l.text.toLowerCase().substring(0, 20)) ||
        l.text.length > 20
      ))
      .slice(0, 4)

    const articleFetches = await Promise.allSettled(
      articleLinks.map(async (link) => {
        try {
          const articleRes = await fetchWithTimeout(link.href, 8000)
          if (!articleRes.ok) return null
          const articleHtml = await articleRes.text()
          const articleText = extractArticleText(articleHtml)

          // Extract date from article
          const dateMatch = articleHtml.match(/publishedTime":\s*"([^"]+)"/) ||
                            articleHtml.match(/datePublished":\s*"([^"]+)"/) ||
                            articleHtml.match(/<time[^>]+datetime="([^"]+)"/)
          const pubDate = dateMatch?.[1] || null
          const recent = isRecent(pubDate)

          if (recent === false) return null // Skip stale articles

          return `--- Article: ${link.text} ---\n${pubDate ? `Published: ${pubDate}\n` : ''}${articleText}`
        } catch {
          return null
        }
      })
    )

    articleContents = articleFetches
      .filter(r => r.status === 'fulfilled' && r.value)
      .map(r => r.value)

    const combined = [
      `${source.name} — Headlines:\n${indexContent}`,
      articleContents.length > 0 ? `\n${source.name} — Full Articles:\n${articleContents.join('\n\n')}` : ''
    ].join('')

    return { name: source.name, content: combined || null }

  } catch {
    return { name: source.name, content: null }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { sources, gmailSources, gmailContent, adhocItems, tone } = req.body

  // Deep scrape all sources in parallel
  const scraped = await Promise.all(SCRAPE_SOURCES.map(deepScrapeSource))
  const successfulScrapes = scraped.filter(s => s.content)
  const failedSources = scraped.filter(s => !s.content).map(s => s.name)

  const scrapedContent = successfulScrapes
    .map(s => `=== ${s.name} ===\n${s.content}`)
    .join('\n\n')

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

CRITICAL ANTI-HALLUCINATION RULES — FOLLOW EXACTLY:
1. ONLY discuss stories explicitly present in the scraped content above
2. Items tagged [STALE - SKIP] are older than 48 hours — do NOT include them
3. Items tagged [FRESH] are within 48 hours — prioritize these
4. Items tagged [DATE UNKNOWN] — include only if highly newsworthy
5. NEVER invent specific names, numbers, product names, or announcements not present verbatim in the content
6. NEVER use your training data to fill in background context — if the article doesn't explain it, don't explain it
7. NEVER interpret or editorialize beyond what the article actually says — report facts first, then your take
8. If an article gives partial information, report only what it says: "Anthropic issued a statement about X" NOT your interpretation of what X means historically
9. Always use full names exactly as they appear in the content
10. If you are uncertain whether a detail is in the scraped content or your training data, OMIT IT
11. Gmail newsletters: include ONLY content related to AI, technology, business strategy, or policy — ignore lifestyle, sports, beauty, entertainment
12. If fewer than 3 fresh stories exist, open with "Lighter news day today —"
13. Every single factual claim must be directly traceable to the scraped content above — no exceptions

TONE: ${tone}

FORMAT — TARGET 15-20 MINUTES SPOKEN (approximately 2000-2500 words):
- Single punchy opening sentence — no "welcome"
- Cover 6-8 distinct stories drawn ONLY from scraped content
- For each story: quote or closely paraphrase what the article actually says (2-3 sentences), then your editorial "why it matters" take (3-4 sentences)
- Clearly distinguish between FACT (from article) and TAKE (your analysis)
- Group related stories thematically where natural
- End with a 3-4 sentence forward-looking close
- Natural spoken word, varied sentence length, no bullet points, no markdown
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
