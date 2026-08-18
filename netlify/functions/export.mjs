import { claveOk, json, listarRsvps } from '../lib/util.mjs'

export default async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method' })
  let body
  try {
    body = await req.json()
  } catch {
    return json(400, { ok: false, error: 'bad_request' })
  }
  if (!claveOk(body.clave)) return json(403, { ok: false, csv: '' })

  const rows = (await listarRsvps()).slice().reverse()
  const esc = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`
  const header = 'Nombre,Apellido,Cancion,Asiste,Acompanantes,Mensaje,Fecha'
  const lines = rows.map((r) =>
    [
      esc(r.nombre),
      esc(r.apellido),
      esc(r.cancion),
      r.asiste === 1 ? 'Si' : 'No',
      r.acompanantes || 0,
      esc(r.mensaje),
      esc(r.created_at),
    ].join(','),
  )
  return json(200, { ok: true, csv: '﻿' + [header, ...lines].join('\r\n') })
}

export const config = { path: '/api/export' }
