import { getStore, getDeployStore } from '@netlify/blobs'

// En producción usa el store global; en deploy previews usa el del deploy,
// así los datos reales nunca se mezclan con pruebas.
export function tienda(nombre) {
  const contexto = globalThis.Netlify?.context?.deploy?.context
  const opciones = { name: nombre, consistency: 'strong' }
  return contexto === 'production' ? getStore(opciones) : getDeployStore(opciones)
}

export function clean(value, max) {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, max)
}

// Las URLs del tema las manda el navegador, así que solo guardamos https de Apple.
export function urlApple(value) {
  if (typeof value !== 'string' || value.length > 300) return ''
  let u
  try {
    u = new URL(value)
  } catch {
    return ''
  }
  if (u.protocol !== 'https:') return ''
  return /(^|\.)(apple\.com|mzstatic\.com)$/.test(u.hostname) ? u.href : ''
}

export function claveOk(clave) {
  const esperada = globalThis.Netlify?.env.get('PANEL_KEY') || 'nostalgia2026'
  return clean(clave, 100) === esperada
}

export function fechaUruguay() {
  const f = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Montevideo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
  return f.format(new Date()).replace('T', ' ')
}

export async function listarRsvps() {
  const store = tienda('rsvps')
  const { blobs } = await store.list()
  const filas = await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' })))
  return filas
    .filter(Boolean)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))
}

export function json(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

export function esImagen(buf) {
  if (buf.length < 12) return false
  const jpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
  const png = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
  const webp =
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  return jpeg || png || webp
}
