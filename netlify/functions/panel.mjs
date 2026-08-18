import { claveOk, json, listarRsvps } from '../lib/util.mjs'

export default async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method' })
  let body
  try {
    body = await req.json()
  } catch {
    return json(400, { ok: false, error: 'bad_request' })
  }
  if (!claveOk(body.clave)) return json(403, { ok: false })

  const rows = await listarRsvps()
  const confirmados = rows.filter((r) => r.asiste === 1)
  return json(200, {
    ok: true,
    rows,
    stats: {
      confirmados: confirmados.length,
      noVienen: rows.length - confirmados.length,
      personas: confirmados.reduce((acc, r) => acc + 1 + (r.acompanantes || 0), 0),
      respuestas: rows.length,
    },
  })
}

export const config = { path: '/api/panel' }
