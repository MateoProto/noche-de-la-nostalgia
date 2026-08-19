/**
 * Noche de la Nostalgia · servidor
 * Sin dependencias: usa el SQLite integrado de Node (node:sqlite, Node 22.5+).
 * Arranque:  node server.js
 * Config:    PORT (default 3000) · PANEL_KEY (clave del panel, default "nostalgia2026")
 * Datos:     ./data/fiesta.db  (SQLite, una tabla: rsvps)
 */
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const { DatabaseSync } = require('node:sqlite')

const PORT = Number(process.env.PORT) || 3000
const PANEL_KEY = process.env.PANEL_KEY || 'nostalgia2026'
const PUBLIC_DIR = path.join(__dirname, 'public')
const DATA_DIR = path.join(__dirname, 'data')

fs.mkdirSync(DATA_DIR, { recursive: true })
const db = new DatabaseSync(path.join(DATA_DIR, 'fiesta.db'))
db.exec(`
  CREATE TABLE IF NOT EXISTS rsvps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    apellido TEXT NOT NULL,
    cancion TEXT NOT NULL,
    asiste INTEGER NOT NULL DEFAULT 1,
    acompanantes INTEGER NOT NULL DEFAULT 0,
    trae TEXT,
    mensaje TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
`)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
}

// rate limit simple: máx 8 envíos por minuto por IP
const hits = new Map()
function rateLimited(ip) {
  const now = Date.now()
  const list = (hits.get(ip) || []).filter((t) => now - t < 60_000)
  if (list.length >= 8) return true
  list.push(now)
  hits.set(ip, list)
  return false
}

function clean(value, max) {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, max)
}

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
}

function sendJson(res, status, obj) {
  securityHeaders(res)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(obj))
}

function readRawBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > maxBytes) {
        reject(new Error('too_large'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function esImagen(buf) {
  if (buf.length < 12) return false
  const jpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
  const png = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
  const webp =
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  return jpeg || png || webp
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > 32_000) {
        reject(new Error('too_large'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
      } catch {
        reject(new Error('bad_json'))
      }
    })
    req.on('error', reject)
  })
}

function playlistData() {
  const stats = db
    .prepare(
      `SELECT COUNT(*) AS confirmados, COALESCE(SUM(1 + acompanantes), 0) AS personas
       FROM rsvps WHERE asiste = 1`,
    )
    .get()
  // Solo contadores: las canciones quedan en secreto hasta la fiesta.
  const total = db.prepare(`SELECT COUNT(*) AS n FROM rsvps`).get()
  return {
    confirmados: Number(stats.confirmados) || 0,
    personas: Number(stats.personas) || 0,
    temas: Number(total.n) || 0,
  }
}

function panelData() {
  const rows = db.prepare(`SELECT * FROM rsvps ORDER BY created_at DESC, id DESC`).all()
  const confirmados = rows.filter((r) => Number(r.asiste) === 1)
  return {
    rows,
    stats: {
      confirmados: confirmados.length,
      noVienen: rows.length - confirmados.length,
      personas: confirmados.reduce((acc, r) => acc + 1 + Number(r.acompanantes), 0),
      respuestas: rows.length,
    },
  }
}

function toCsv() {
  const rows = db.prepare(`SELECT * FROM rsvps ORDER BY created_at ASC`).all()
  const esc = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`
  const header = 'Nombre,Apellido,Cancion,Asiste,Acompanantes,Mensaje,Fecha'
  const lines = rows.map((r) =>
    [
      esc(r.nombre),
      esc(r.apellido),
      esc(r.cancion),
      Number(r.asiste) === 1 ? 'Si' : 'No',
      Number(r.acompanantes),
      esc(r.mensaje),
      esc(r.created_at),
    ].join(','),
  )
  return '﻿' + [header, ...lines].join('\r\n')
}

async function handleApi(req, res, url) {
  const ip = req.socket.remoteAddress || 'desconocida'

  if (req.method === 'GET' && url.pathname === '/api/playlist') {
    return sendJson(res, 200, playlistData())
  }

  if (req.method === 'POST' && url.pathname === '/api/rsvp') {
    if (rateLimited(ip)) return sendJson(res, 429, { ok: false, error: 'rate' })
    let body
    try {
      body = await readBody(req)
    } catch {
      return sendJson(res, 400, { ok: false, error: 'bad_request' })
    }
    // honeypot: si un bot llenó el campo oculto, respondemos ok sin guardar
    if (clean(body.web, 100)) return sendJson(res, 200, { ok: true })
    const nombre = clean(body.nombre, 60)
    const apellido = clean(body.apellido, 60)
    const cancion = clean(body.cancion, 120)
    if (!nombre || !apellido || !cancion) {
      return sendJson(res, 400, { ok: false, error: 'missing_fields' })
    }
    const asiste = body.asiste === true || body.asiste === 'si' ? 1 : 0
    const nRaw = Number(body.acompanantes)
    const acompanantes =
      asiste === 1 && Number.isInteger(nRaw) ? Math.min(Math.max(nRaw, 0), 5) : 0
    const mensaje = clean(body.mensaje, 300)
    db.prepare(
      `INSERT INTO rsvps (nombre, apellido, cancion, asiste, acompanantes, mensaje)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(nombre, apellido, cancion, asiste, acompanantes, mensaje)
    return sendJson(res, 200, { ok: true })
  }

  if (req.method === 'POST' && url.pathname === '/api/panel') {
    let body
    try {
      body = await readBody(req)
    } catch {
      return sendJson(res, 400, { ok: false, error: 'bad_request' })
    }
    if (clean(body.clave, 100) !== PANEL_KEY) return sendJson(res, 403, { ok: false })
    return sendJson(res, 200, { ok: true, ...panelData() })
  }

  if (req.method === 'GET' && url.pathname === '/api/foto') {
    const rutaFoto = path.join(PUBLIC_DIR, 'fiesta.jpg')
    if (!fs.existsSync(rutaFoto)) return sendJson(res, 404, { ok: false })
    securityHeaders(res)
    res.writeHead(200, { 'content-type': 'image/jpeg', 'cache-control': 'no-cache' })
    res.end(fs.readFileSync(rutaFoto))
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/borrar') {
    let body
    try {
      body = await readBody(req)
    } catch {
      return sendJson(res, 400, { ok: false, error: 'bad_request' })
    }
    if (clean(body.clave, 100) !== PANEL_KEY) return sendJson(res, 403, { ok: false })
    const id = Number(body.id)
    if (!Number.isInteger(id)) return sendJson(res, 400, { ok: false, error: 'missing_id' })
    db.prepare(`DELETE FROM rsvps WHERE id = ?`).run(id)
    return sendJson(res, 200, { ok: true })
  }

  if (req.method === 'POST' && url.pathname === '/api/foto') {
    if (rateLimited(ip)) return sendJson(res, 429, { ok: false, error: 'rate' })
    if (clean(req.headers['x-clave'], 100) !== PANEL_KEY) {
      return sendJson(res, 403, { ok: false, error: 'clave' })
    }
    let buf
    try {
      buf = await readRawBody(req, 15_000_000)
    } catch {
      return sendJson(res, 413, { ok: false, error: 'too_large' })
    }
    if (!esImagen(buf)) {
      return sendJson(res, 400, { ok: false, error: 'not_image' })
    }
    fs.writeFileSync(path.join(PUBLIC_DIR, 'fiesta.jpg'), buf)
    return sendJson(res, 200, { ok: true })
  }

  if (req.method === 'POST' && url.pathname === '/api/export') {
    let body
    try {
      body = await readBody(req)
    } catch {
      return sendJson(res, 400, { ok: false, error: 'bad_request' })
    }
    if (clean(body.clave, 100) !== PANEL_KEY) return sendJson(res, 403, { ok: false })
    return sendJson(res, 200, { ok: true, csv: toCsv() })
  }

  return sendJson(res, 404, { ok: false, error: 'not_found' })
}

function serveStatic(res, filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const type = MIME[ext] || 'application/octet-stream'
  fs.readFile(filePath, (err, data) => {
    if (err) {
      securityHeaders(res)
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      res.end('No encontrado')
      return
    }
    securityHeaders(res)
    res.writeHead(200, {
      'content-type': type,
      'cache-control':
        ext === '.html' || ext === '.css' || ext === '.js'
          ? 'no-cache'
          : 'public, max-age=3600',
    })
    res.end(data)
  })
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)

  if (url.pathname.startsWith('/api/')) {
    try {
      await handleApi(req, res, url)
    } catch (err) {
      console.error('API error:', err)
      sendJson(res, 500, { ok: false, error: 'server' })
    }
    return
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    securityHeaders(res)
    res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('Método no permitido')
    return
  }

  let pathname = decodeURIComponent(url.pathname)
  if (pathname === '/') pathname = '/index.html'
  if (pathname === '/panel') pathname = '/panel.html'
  if (pathname === '/foto') pathname = '/foto.html'

  const filePath = path.join(PUBLIC_DIR, pathname)
  if (!filePath.startsWith(PUBLIC_DIR)) {
    securityHeaders(res)
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('Ruta inválida')
    return
  }
  serveStatic(res, filePath)
})

server.listen(PORT, () => {
  console.log(`Noche de la Nostalgia lista en http://localhost:${PORT}`)
  console.log(`Panel de invitados en http://localhost:${PORT}/panel`)
})
