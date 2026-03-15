export default function handler(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri = 'https://pavement-podcast.vercel.app/api/auth/callback'
  
  const scope = [
    'https://www.googleapis.com/auth/gmail.readonly'
  ].join(' ')

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', scope)
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')

  res.redirect(authUrl.toString())
}
