async function refreshAccessToken(refreshToken) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token'
    })
  })
  return res.json()
}

function getTokensFromCookie(req) {
  const cookieHeader = req.headers.cookie || ''
  const match = cookieHeader.match(/gmail_tokens=([^;]+)/)
  if (!match) return null
  try {
    return JSON.parse(decodeURIComponent(match[1]))
  } catch {
    return null
  }
}

function scoreEmail(subject, senderUrl) {
  const s = subject.toLowerCase()

  // NYT specific newsletter detection
  if (senderUrl.includes('nytimes')) {
    if (s.startsWith('the morning:')) return 100
    if (s.startsWith('the evening:')) return 100
    if (s.startsWith('dealbook:')) return 100
    return 0 // Skip all other NYT emails
  }

  // General relevance scoring for other senders
  const highSignal = ['ai', 'artificial intelligence', 'tech', 'briefing', 'daily', 'morning', 'evening', 'weekly', 'roundup', 'digest', 'startup', 'venture', 'funding', 'acquisition', 'model', 'openai', 'anthropic', 'google', 'microsoft', 'meta', 'apple']
  const lowSignal = ['recipe', 'cooking', 'food', 'sports', 'fashion', 'beauty', 'lifestyle', 'travel', 'health', 'fitness', 'horoscope', 'sale', 'discount', 'unsubscribe']

  let score = 50 // default
  for (const word of highSignal) {
    if (s.includes(word)) score += 20
  }
  for (const word of lowSignal) {
    if (s.includes(word)) score -= 40
  }
  return score
}

async function fetchEmailsFromSender(accessToken, sender) {
  try {
    // Build smart search query
    const domain = sender.url
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]

    // Special cases for known senders with non-obvious domains
    const searchDomain = sender.name === 'Superhuman AI' ? 'mail.joinsuperhuman.ai' : domain

    const query = encodeURIComponent(`from:${searchDomain} newer_than:3d`)
    const maxResults = domain.includes('nytimes') ? 20 : 5

    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=${maxResults}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const listData = await listRes.json()

    if (!listData.messages || listData.messages.length === 0) return null

    // Fetch metadata for all messages to score by subject
    const metaFetches = await Promise.all(
      listData.messages.map(msg =>
        fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        ).then(r => r.json())
      )
    )

    // Score each email and pick the best one
    const scored = metaFetches
      .map(msg => {
        const headers = msg.payload?.headers || []
        const subject = headers.find(h => h.name === 'Subject')?.value || ''
        const date = headers.find(h => h.name === 'Date')?.value || ''
        const score = scoreEmail(subject, sender.url)
        return { id: msg.id, subject, date, score }
      })
      .filter(m => m.score > 0) // Drop irrelevant emails entirely
      .sort((a, b) => b.score - a.score)

    if (scored.length === 0) return null

    // Fetch full body of the best scoring email
    const best = scored[0]
    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${best.id}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const msgData = await msgRes.json()

    // Extract body text
    let body = ''
    function extractBody(parts) {
      if (!parts) return
      for (const part of parts) {
        if (part?.mimeType === 'text/plain' && part?.body?.data) {
          body += Buffer.from(part.body.data, 'base64').toString('utf-8')
        } else if (part?.mimeType === 'text/html' && part?.body?.data && !body) {
          // Fall back to HTML if no plain text
          const html = Buffer.from(part.body.data, 'base64').toString('utf-8')
          body += html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        } else if (part?.parts) {
          extractBody(part.parts)
        }
      }
    }

    extractBody(msgData.payload?.parts || [msgData.payload])

    // If body is still empty try the payload body directly
    if (!body && msgData.payload?.body?.data) {
      body = Buffer.from(msgData.payload.body.data, 'base64').toString('utf-8')
      if (body.includes('<')) {
        body = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      }
    }

    const cleanBody = body
      .replace(/https?:\/\/\S+/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 2000)

    if (!cleanBody || cleanBody.length < 50) return null

    return {
      sender: sender.name,
      subject: best.subject,
      date: best.date,
      body: cleanBody
    }

  } catch (e) {
    console.error(`Gmail fetch failed for ${sender.name}:`, e)
    return null
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const tokens = getTokensFromCookie(req)
  if (!tokens) {
    return res.status(401).json({ error: 'Not authenticated', needsAuth: true })
  }

  let accessToken = tokens.access_token

  // Refresh if expired
  if (Date.now() > tokens.expiry - 60000) {
    if (!tokens.refresh_token) {
      return res.status(401).json({ error: 'Token expired', needsAuth: true })
    }
    const refreshed = await refreshAccessToken(tokens.refresh_token)
    if (!refreshed.access_token) {
      return res.status(401).json({ error: 'Refresh failed', needsAuth: true })
    }
    accessToken = refreshed.access_token
  }

  const { senders } = req.body

  if (!senders || senders.length === 0) {
    return res.status(200).json({ emails: [] })
  }

  // Fetch emails from all senders in parallel
  const results = await Promise.all(
    senders.map(sender => fetchEmailsFromSender(accessToken, sender))
  )

  const emails = results.filter(Boolean)

  return res.status(200).json({ emails })
}
