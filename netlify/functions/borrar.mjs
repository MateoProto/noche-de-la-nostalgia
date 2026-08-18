import { claveOk, clean, json, tienda } from '../lib/util.mjs'

export default async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method' })
  let body
  try {
    body = await req.json()
  } catch {
    return json(400, { ok: false, error: 'bad_request' })
  }
  if (!claveOk(body.clave)) return json(403, { ok: false })
  const id = clean(body.id, 100)
  if (!id) return json(400, { ok: false, error: 'missing_id' })
  await tienda('rsvps').delete(`rsvps/${id}`)
  return json(200, { ok: true })
}

export const config = { path: '/api/borrar' }
