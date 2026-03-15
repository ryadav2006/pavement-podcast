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
                   item.match
