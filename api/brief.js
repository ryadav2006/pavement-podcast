import { Redis } from '@upstash/redis'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const redis = new Redis({
      url: process.env.UPSTASH_KV_REST_API_URL,
      token: process.env.UPSTASH_KV_REST_API_TOKEN,
    })

    const latest = await redis.get('latest_brief')
    if (!latest) {
      return res.status(404).json({ error: 'No brief found' })
    }

    const data = typeof latest === 'string' ? JSON.parse(latest) : latest
    return res.status(200).json(data)

  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
