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

async function fetchEmailsFromSender(accessToken, senderDomain, maxResults = 1) {
  try {
    const query = encodeURIComponent(`from:${senderDomain} newer_than:2d`)
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=${maxResults}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const listData = await listRes.json()

    if (!listData.messages || listData.messages.length === 0) {
      return null
    }

    // Get the most recent message
    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${listData.messages[0].id}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const msgData = await msgRes.json()

    // Extract subject
    const headers = msgData.payload?.headers || []
    const subject = headers.find(h => h.name === 'Subject')?.value || 'No subject'
    const date = headers.find(h => h.name === 'Date')?.value || ''

    // Extract body text
    let body = ''
    const parts = msgData.payload?.parts || [msgData.payload]

    function extractBody(parts) {
      for (const part of parts) {
        if (part?.mimeType === 'text/plain' && part?.body?.data) {
          body += Buffer.from(part.body.data, 'base64').toString('utf-8')
        } else if (part?.parts) {
          extractBody(part.parts)
        }
      }
    }

    extractBody(parts)

    // Clean and truncate
    const cleanBody = body
      .replace(/https?:\/\/\S+/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 1500)

    return {
      sender: senderDomain,
      subject,
      date,
      body: cleanBody
    }

  } catch {
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
    senders.map(sender => fetchEmailsFromSender(accessToken, sender.url))
  )

  const emails = results.filter(Boolean)

  return res.status(200).json({ emails })
}
