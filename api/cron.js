import { Redis } from '@upstash/redis'

export const config = {
  maxDuration: 300
}

const WEB_SOURCES = [
  {name:"TechCrunch AI",   url:"techcrunch.com/tag/artificial-intelligence", type:"news",      badge:"free",    on:true},
  {name:"MIT Tech Review", url:"technologyreview.com",                       type:"magazine",  badge:"free",    on:true},
  {name:"The Verge",       url:"theverge.com",                               type:"news",      badge:"free",    on:true},
  {name:"OpenAI News",     url:"openai.com/news",                            type:"blog",      badge:"free",    on:true},
  {name:"Google Gemini",   url:"blog.google/products-and-platforms/gemini",  type:"blog",      badge:"free",    on:true},
  {name:"Axios Pro Rata",  url:"axios.com/pro/media-deals",                  type:"news",      badge:"partial", on:true},
  {name:"Ben Evans",       url:"ben-evans.com",                              type:"blog",      badge:"free",    on:true},
]

const GMAIL_SOURCES = [
  {name:"NYT Morning Briefing", url:"nytimes.com",        type:"newsletter", badge:"gmail", on:true},
  {name:"Morning Brew",         url:"morningbrew.com",    type:"newsletter", badge:"gmail", on:true},
  {name:"TLDR Newsletter",      url:"tldr.tech",          type:"newsletter", badge:"gmail", on:true},
  {name:"The Rundown AI",       url:"therundown.ai",      type:"newsletter", badge:"gmail", on:true},
  {name:"Superhuman AI",        url:"superhumanai.com",   type:"newsletter", badge:"gmail", on:true},
  {name:"Axios AI+",            url:"axios.com",          type:"newsletter", badge:"gmail", on:true},
  {name:"Last Week in AI",      url:"lastweekin.ai",      type:"newsletter", badge:"gmail", on:true},
  {name:"The AI Report",        url:"theaireport.com",    type:"newsletter", badge:"gmail", on:true},
  {name:"a16z Newsletter",      url:"a16z.com",           type:"newsletter", badge:"gmail", on:true},
]

export default async function handler(req, res) {
  const authHeader = req.headers['authorization']
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const baseUrl = 'https://pavement-podcast.vercel.app'

    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sources: WEB_SOURCES,
        gmailSources: GMAIL_SOURCES,
        gmailContent: [],
        adhocItems: [],
        tone: 'sharp and opinionated'
      })
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(500).json({ error: data.error || 'Generate failed' })
    }

    const redis = new Redis({
      url: process.env.UPSTASH_KV_REST_API_URL,
      token: process.env.UPSTASH_KV_REST_API_TOKEN,
    })

    const today = new Date().toLocaleDateString('en-US', {
      month: 'numeric', day: 'numeric', year: '2-digit'
    })

    await redis.set('latest_brief', JSON.stringify({
      date: today,
      brief: data.brief,
      notebooklm: data.notebooklm,
      generatedAt: new Date().toISOString()
    }))

    const existing = await redis.get('brief_history')
    const history = existing ? JSON.parse(existing) : []
    history.unshift({
      date: today,
      title: `Daily Brief — ${today}`,
      brief: data.brief.substring(0, 200) + '...',
      notebooklm: data.notebooklm,
      sources: WEB_SOURCES.filter(s => s.on).length + GMAIL_SOURCES.filter(s => s.on).length
    })
    const trimmed = history.slice(0, 14)
    await redis.set('brief_history', JSON.stringify(trimmed))

    return res.status(200).json({ success: true, date: today })

  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
