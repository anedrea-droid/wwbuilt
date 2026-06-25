import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { v2 as cloudinary } from 'cloudinary'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const { rows } = await pool.query(
    'SELECT id, url, public_id, created_at FROM work_order_photos WHERE work_order_id = $1 ORDER BY created_at ASC',
    [id]
  )
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const dataUri = 'data:' + file.type + ';base64,' + buffer.toString('base64')

    const result = await cloudinary.uploader.upload(dataUri, {
      folder: 'ww-small-engine',
      transformation: [{ width: 1600, crop: 'limit', quality: 'auto' }],
    })

    const { rows } = await pool.query(
      'INSERT INTO work_order_photos (work_order_id, url, public_id) VALUES ($1, $2, $3) RETURNING id, url, public_id, created_at',
      [id, result.secure_url, result.public_id]
    )
    return NextResponse.json(rows[0], { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  try {
    const { photoId } = await req.json() as { photoId: string }
    const { rows } = await pool.query(
      'SELECT public_id FROM work_order_photos WHERE id = $1 AND work_order_id = $2',
      [photoId, id]
    )
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await cloudinary.uploader.destroy(rows[0].public_id)
    await pool.query('DELETE FROM work_order_photos WHERE id = $1', [photoId])
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
