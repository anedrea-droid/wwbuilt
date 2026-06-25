import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  const { password } = await req.json() as { password: string }
  const sitePassword = process.env.SITE_PASSWORD || 'ww53r'
  if (password !== sitePassword) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
  }
  const token = crypto.createHash('sha256').update(sitePassword + 'ww-salt-2025').digest('hex')
  const res = NextResponse.json({ success: true })
  res.cookies.set('ww_auth', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
  return res
}
