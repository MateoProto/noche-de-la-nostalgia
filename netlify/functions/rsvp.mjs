import { clean, fechaUruguay, json, tienda } from '../lib/util.mjs'

export default async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method' })
  let body
  try {
    body = await req.json()
  } catch {
    return json(400, { ok: false, error: 'bad_request' })
  }
  // honeypot: si un bot llenó el campo oculto, respondemos ok sin guardar
  if (clean(body.web, 100)) return json(200, { ok: true })

  const nombre = clean(body.nombre, 60)
  const apellido = clean(body.apellido, 60)
  const cancion = clean(body.cancion, 120)
  if (!nombre || !apellido || !cancion) {
    return json(400, { ok: false, error: 'missing_fields' })
  }
  const asiste = body.asiste === true || body.asiste === 'si' ? 1 : 0
  const nRaw = Number(body.acompanantes)
  const acompanantes =
    asiste === 1 && Number.isInteger(nRaw) ? Math.min(Math.max(nRaw, 0), 5) : 0

  const id = crypto.randomUUID()
  const fila = {
    id,
    nombre,
    apellido,
    cancion,
    asiste,
    acompanantes,
    mensaje: clean(body.mensaje, 300),
    created_at: fechaUruguay(),
  }
  await tienda('rsvps').setJSON(`rsvps/${id}`, fila)
  return json(200, { ok: true })
}

export const config = { path: '/api/rsvp' }
