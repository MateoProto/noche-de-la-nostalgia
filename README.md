# Noche de la Nostalgia · sitio de la fiesta

Página de invitación con formulario de confirmación, playlist en vivo y panel
de organizador. Sin dependencias: solo necesita **Node.js 22.5 o más nuevo**
(usa el SQLite que viene integrado en Node).

## Probarlo en tu compu

```bash
node server.js
```

- Página de invitados: http://localhost:3000
- Panel del organizador: http://localhost:3000/panel
  - Clave por defecto: `nostalgia2026` (cambiala, ver abajo)
- Subir/cambiar la foto de la fiesta: http://localhost:3000/foto
  (misma clave; la foto queda en `public/fiesta.jpg`)

## Dónde quedan los datos

Todo se guarda en `data/fiesta.db` (un archivo SQLite con una sola tabla
`rsvps`). Tres formas de ver los datos:

1. **Panel web** en `/panel`: totales, tabla completa, botón para bajar un
   CSV (se abre en Excel) y para copiar la lista de temas.
2. **CSV**: botón "Descargar CSV" en el panel.
3. **El archivo directo**: `data/fiesta.db` se puede abrir con cualquier
   visor de SQLite (por ejemplo "DB Browser for SQLite").

## Configuración (variables de entorno)

| Variable | Qué hace | Default |
|---|---|---|
| `PORT` | Puerto del servidor | `3000` |
| `PANEL_KEY` | Clave del panel `/panel` | `nostalgia2026` |

En Windows (PowerShell): `$env:PANEL_KEY = "mi-clave"; node server.js`

## Ponerlo online

Cualquier hosting que corra Node sirve. Los dos más fáciles y gratis:

### Railway (recomendado: los datos persisten)
1. Subí esta carpeta a un repo de GitHub (o usá `railway up` con su CLI).
2. En [railway.app](https://railway.app): New Project → Deploy from GitHub.
3. En Settings → Variables agregá `PANEL_KEY` con tu clave secreta.
4. Importante: agregá un **Volume** montado en `/app/data` para que la base
   de datos sobreviva a los redeploys.

### Render
1. New → Web Service, conectá el repo.
2. Build command: (vacío) · Start command: `node server.js`.
3. Variable `PANEL_KEY` con tu clave.
4. En el plan gratis el disco es efímero: si el servicio se reinicia se
   pierden los datos. Para una fiesta de una semana suele alcanzar, pero si
   querés seguridad total usá Railway con Volume, o bajá el CSV seguido.

Nota: el link de la fiesta que compartas por WhatsApp va a mostrar el póster
de la bola de espejos (está configurado en `public/index.html` como imagen
de vista previa).

## Estructura

```
server.js          servidor (API + estáticos), sin dependencias
public/index.html  página de invitación con el formulario
public/panel.html  panel del organizador (protegido por clave)
public/styles.css  todo el diseño (neón, bola de espejos, animaciones)
public/og.png      póster para la vista previa de WhatsApp
public/fiesta.jpg  foto de la fiesta (fondo de la sección "Dónde es")
data/fiesta.db     base de datos (se crea sola al arrancar)
```
