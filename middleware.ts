import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

async function hashPassword(pass: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(pass + "ww-salt-2025")
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("")
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) {
    return NextResponse.next()
  }

  const pass = process.env.SITE_PASSWORD || "ww53r"
  const expectedToken = await hashPassword(pass)
  const cookie = request.cookies.get("ww_auth")

  if (!cookie || cookie.value !== expectedToken) {
    const loginUrl = new URL("/login", request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json).*)",
  ],
}
