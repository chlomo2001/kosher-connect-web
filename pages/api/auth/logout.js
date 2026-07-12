import { sessionCookie } from '../../../lib/auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  res.setHeader('Set-Cookie', sessionCookie(null)) // expire the cookie
  return res.json({ success: true })
}
