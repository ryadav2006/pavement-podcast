export default async function handler(req, res) {
  const { code, error } = req.query

  if (error) {
    return res.redirect('/?gmail=error')
  }

  if (!code) {
    return res.redirect('/?gmail=error')
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: 'https://pavement-podcast.vercel.app/api/auth/callback',
        grant_type: 'authorization_code'
      })
    })

    const tokens = await tokenRes.json()

    if (!tokens.access_token) {
      return res.redirect('/?gmail=error')
    }

    // Store tokens in a cookie (httpOnly for security)
    const cookieValue = JSON.stringify({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry: Date.now() + (tokens.expires_in * 1000)
    })

    res.setHeader('Set-Cookie', [
      `gmail_tokens=${encodeURIComponent(cookieValue)}; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000; Path=/`
    ])

    return res.redirect('/?gmail=connected')

  } catch (err) {
    return res.redirect('/?gmail=error')
  }
}
