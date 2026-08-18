import { claveOk, esImagen, json, tienda } from '../lib/util.mjs'

export default async (req) => {
  const store = tienda('fotos')

  if (req.method === 'GET') {
    const foto = await store.get('fiesta', { type: 'arrayBuffer' })
    if (!foto) return new Response('Sin foto subida', { status: 404 })
    return new Response(foto, {
      status: 200,
      headers: {
        'content-type': 'image/jpeg',
        'cache-control': 'public, max-age=300',
      },
    })
  }

  if (req.method === 'POST') {
    if (!claveOk(req.headers.get('x-clave'))) return json(403, { ok: false, error: 'clave' })
    const buf = Buffer.from(await req.arrayBuffer())
    if (buf.length > 15_000_000) return json(413, { ok: false, error: 'too_large' })
    if (!esImagen(buf)) return json(400, { ok: false, error: 'not_image' })
    await store.set('fiesta', buf)
    return json(200, { ok: true })
  }

  return json(405, { ok: false, error: 'method' })
}

export const config = { path: '/api/foto' }
