import { json, listarRsvps } from '../lib/util.mjs'

export default async (req) => {
  if (req.method !== 'GET') return json(405, { ok: false, error: 'method' })
  const filas = await listarRsvps()
  const confirmadas = filas.filter((r) => r.asiste === 1)
  return json(200, {
    confirmados: confirmadas.length,
    personas: confirmadas.reduce((acc, r) => acc + 1 + (r.acompanantes || 0), 0),
    temas: filas.slice(0, 150).map((r) => ({
      cancion: r.cancion,
      nombre: r.nombre,
      inicial: (r.apellido || '?').slice(0, 1),
      asiste: r.asiste,
    })),
  })
}

export const config = { path: '/api/playlist' }
