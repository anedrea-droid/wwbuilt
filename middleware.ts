import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

function getToken() {
  const pass = process.env.SITE_PASSWORD || 'ww53r'
  return crypto.createHash('sha256').update(pass + 'ww-salt-2025').digest('hex')
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }
  const cookie = request.cookies.get('ww_auth')?.value
  if (cookie !== getToken()) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
