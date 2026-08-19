import { json, listarRsvps } from '../lib/util.mjs'

export default async (req) => {
  if (req.method !== 'GET') return json(405, { ok: false, error: 'method' })
  const filas = await listarRsvps()
  const confirmadas = filas.filter((r) => r.asiste === 1)
  // Solo contadores: las canciones quedan en secreto hasta la fiesta.
  return json(200, {
    confirmados: confirmadas.length,
    personas: confirmadas.reduce((acc, r) => acc + 1 + (r.acompanantes || 0), 0),
    temas: filas.length,
  })
}

export const config = { path: '/api/playlist' }
