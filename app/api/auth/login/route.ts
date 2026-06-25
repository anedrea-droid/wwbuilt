import { NextResponse } from "next/server"
import { createHash } from "crypto"
import { cookies } from "next/headers"

export async function POST(request: Request) {
  const body = await request.json()
  const { password } = body
  const correctPass = process.env.SITE_PASSWORD || "ww53r"

  if (password !== correctPass) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 })
  }

  const token = createHash("sha256")
    .update(correctPass + "ww-salt-2025")
    .digest("hex")

  const cookieStore = await cookies()
  cookieStore.set("ww_auth", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
    path: "/",
  })

  return NextResponse.json({ ok: true })
}
