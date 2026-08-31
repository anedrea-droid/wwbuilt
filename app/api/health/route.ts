import { NextResponse } from 'next/server'

// Lightweight health check endpoint for Railway's deployment healthcheck.
// Intentionally excluded from the password middleware (see middleware.ts) so it
// always returns a clean 200 OK, regardless of login state.
export async function GET() {
  return NextResponse.json({ status: 'ok' })
}
