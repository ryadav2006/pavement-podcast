const SCRAPE_SOURCES = [
  { name: "OpenAI News", url: "https://openai.com/blog/rss.xml", type: "rss" },
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

function extractPublishDate(html) {
  const patterns = [
    /publishedTime":\s*"([^"]+)"/,
    /datePublished":\s*"([^"]+)"/,
    /<time[^>]+datetime="([^"]+)"/,
    /published_time"\s+content="([^"]+)"/,
    /"dateModified":"([^"]+)"/,
  ]
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) return match[1]
  }
  return null
}

function extractArticleText(html) {
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')

  const articleMatch = text.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
  if (articleMatch) {
    return articleMatch[1]
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 3000)
  }

  const mainMatch = text.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
  if (mainMatch) {
    return mainMatch[1]
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 3000)
  }

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

    if (!href || href.startsWith('#') || href.startsWith('mailto:') ||
        href.includes('twitter.com') || href.includes('facebook.com') ||
        href.includes('login') || href.includes('subscribe') ||
        href.includes('account') || text.length < 10) continue

    if (href.startsWith('/')) {
      try {
        const base = new URL(baseUrl)
        href = `${base.protocol}//${base.host}${href}`
      } catch { continue }
    } else if (!href.startsWith('http')) {
      continue
    }

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
    const res = await fetchWithTimeout(source.url, 10000)
    if (!res.ok) return { name: source.name, content: null }
    const html = await res.text()

    // Handle RSS separately
    if (source.type === 'rss') {
      const items = []
      const itemRegex = /<item>([\s\S]*?)<\/item>/gi
      let match
      let count = 0
      while ((match = itemRegex.exec(html)) !== null && count < 10) {
        const item = match[1]
        const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
                       item.match(/<title>(.*?)<\/title>/))?.[1]?.trim() || ''
        const desc = (item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ||
                      item.match(/<description>([\s\S]*?)<\/description>/))?.[1] || ''
        const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim() || ''
        const recent = isRecent(pubDate)

        // STRICT: skip stale items entirely
        if (recent === false) continue

        if (title) {
          const cleanDesc = desc.replace(/<[^>]+>/g, '').substring(0, 500)
          items.push(`[FRESH] ${title}\nPublished: ${pubDate}\n${cleanDesc}`)
          count++
        }
      }
      return {
        name: source.name,
        content: items.length > 0 ? `${source.name}:\n${items.join('\n\n')}` : null
      }
    }

    // HTML: extract headlines with dates
    const freshHeadlines = []
    const unknownHeadlines = []
    const headlineRegex = /<h[123][^>]*>([\s\S]*?)<\/h[123]>/gi
    let match
    while ((match = headlineRegex.exec(html)) !== null) {
      const headline = match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
      if (headline.length < 15 || headline.length > 200) continue

      const nearby = html.substring(match.index, match.index + 600)
      const dateMatch = nearby.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?\s+\d{1,2},?\s+\d{4}\b/i) ||
                        nearby.match(/\b\d{4}-\d{2}-\d{2}\b/) ||
                        nearby.match(/datetime="([^"]+)"/)
      const dateStr = dateMatch?.[1] || dateMatch?.[0] || null
      const recent = isRecent(dateStr)

      // STRICT: skip stale headlines entirely
      if (recent === false) continue

      if (recent === true) {
        freshHeadlines.push({ text: headline, dateStr, index: match.index })
      } else {
        unknownHeadlines.push({ text: headline, dateStr, index: match.index })
      }
    }

    // Use fresh headlines, fall back to unknown only if no fresh ones found
    const headlinesToUse = freshHeadlines.length > 0
      ? freshHeadlines.slice(0, 10)
      : unknownHeadlines.slice(0, 5)

    if (headlinesToUse.length === 0) {
      return { name: source.name, content: null }
    }

    const headlineText = headlinesToUse
      .map(h => `${freshHeadlines.includes(h) ? '[FRESH]' : '[DATE UNKNOWN]'} ${h.text}${h.dateStr ? ` | ${h.dateStr}` : ''}`)
      .join('\n')

    // Only fetch article links for FRESH headlines
    const links = extractLinks(html, source.url)
    const articlesToFetch = links
      .filter(l => l.text.length > 20)
      .slice(0, 4)

    const articleFetches = await Promise.allSettled(
      articlesToFetch.map(async (link) => {
        try {
          const articleRes = await fetchWithTimeout(link.href, 8000)
          if (!articleRes.ok) return null
          const articleHtml = await articleRes.text()

          // Check publish date of the article itself
          const pubDate = extractPublishDate(articleHtml)
          const recent = isRecent(pubDate)

          // STRICT: if we can confirm it's stale, skip it
          if (recent === false) return null

          const articleText = extractArticleText(articleHtml)
          const dateLabel = pubDate
            ? `Published: ${new Date(pubDate).toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric', year:'numeric'})}`
            : 'Published: Date unknown'

          return `--- ${link.text} ---\n${dateLabel}\n${articleText}`
        } catch {
          return null
        }
      })
    )

    const articleContents = articleFetches
      .filter(r => r.status === 'fulfilled' && r.value)
      .map(r => r.value)

    const combined = [
      `${source.name} — Recent Headlines:\n${headlineText}`,
      articleContents.length > 0
        ? `\n${source.name} — Full Article Content:\n${articleContents.join('\n\n')}`
        : ''
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

  const scraped = await Promise.all(SCRAPE_SOURCES.map(deepScrapeSource))
  const successfulScrapes = scraped.filter(s => s.content)
  const failedSources = scraped.filter(s => !s.content).map(s => s.name)

  const scrapedContent = successfulScrapes
    .map(s => `=== ${s.name} ===\n${s.content}`)
    .join('\n\n')

  const gmailContentFormatted = gmailContent && gmailContent.length > 0
    ? gmailContent.map(email =>
        `=== NEWSLETTER: ${email.sender} — "${email.subject}" (${email.date}) ===\n${email.body}`
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

LIVE SCRAPED WEB CONTENT:
${scrapedContent || 'No fresh web content found today.'}

${gmailContentFormatted ? `LIVE GMAIL NEWSLETTERS:\n${gmailContentFormatted}` : 'GMAIL: Not connected or no recent newsletters.'}

${adhocList ? `AD HOC ITEMS:\n${adhocList}` : ''}

${failedSources.length > 0 ? `SOURCES WITH NO FRESH CONTENT TODAY: ${failedSources.join(', ')}` : ''}

CRITICAL RULES — NO EXCEPTIONS:
1. Only report stories present in the content above
2. Never use training data to fill gaps or add background context
3. If an article gives partial information, report only what it says — do not interpret using outside knowledge
4. Never invent names, numbers, dates, or product details not explicitly in the content
5. Always use full names exactly as they appear in the content
6. Gmail newsletters: only include AI, tech, business strategy, or policy content — skip lifestyle, sports, beauty, entertainment
7. If a source has no fresh content today, skip it entirely — do not reference old stories from that source
8. If fewer than 3 stories are available, open with "Lighter news day today —" and go deeper on what exists
9. No markdown formatting — no bold, no headers, no asterisks — pure spoken word only
10. Every factual claim must come directly from the scraped content above

TONE: ${tone}

FORMAT — TARGET 15-20 MINUTES SPOKEN (~2000-2500 words):
- Single punchy opening sentence, no "welcome"
- Cover 6-8 stories from fresh content only
- Each story: facts from the article (2-3 sentences) then your editorial take (3-4 sentences)
- Natural spoken word, no bullets, no markdown
- 3-4 sentence forward-looking close

After the script write exactly:
---NOTEBOOKLM---
Same briefing for NotebookLM with source attributions in brackets and a context note at the top for ${today}.`

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
