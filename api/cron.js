import { WEB_SOURCES, GMAIL_SOURCES } from './config.js'

export const config = {
  maxDuration: 300
}

export default async function handler(req, res) {
  // Verify this is called by Vercel cron, not a random person
  const authHeader = req.headers['authorization']
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    // Call the generate endpoint internally
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://pavement-podcast.vercel.app'

    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sources: WEB_SOURCES,
        gmailSources: GMAIL_SOURCES,
        gmailContent: [], // Gmail OAuth not available in cron — web sources only
        adhocItems: [],
        tone: 'sharp and opinionated'
      })
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(500).json({ error: data.error || 'Generate failed' })
    }

    // Store the result in Vercel KV so the app can display it
    const { kv } = await import('@vercel/kv')
    const today = new Date().toLocaleDateString('en-US', {
      month: 'numeric', day: 'numeric', year: '2-digit'
    })

    await kv.set('latest_brief', JSON.stringify({
      date: today,
      brief: data.brief,
      notebooklm: data.notebooklm,
      generatedAt: new Date().toISOString()
    }))

    await kv.set('brief_history', JSON.stringify(
      [{ date: today, brief: data.brief.substring(0, 200) + '...', notebooklm: data.notebooklm }]
    ))

    return res.status(200).json({ success: true, date: today })

  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
