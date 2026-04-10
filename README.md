# Estudiantes TBÓ

Sitio oficial y panel administrativo del Club Estudiantes TBÓ.

## Estructura

- `index.html`: home pública
- `admin.html`: panel privado para gestionar la agenda
- `style.css`: estilos de la web pública
- `admin.css`: estilos del panel
- `schedule-core.js`: lógica compartida de horarios y disciplinas
- `booking-data.js`: store híbrido que usa backend real cuando existe y cache local como fallback
- `server.js`: servidor Node que publica el sitio y expone la API real
- `data/schedule-state.json`: persistencia compartida de la agenda
- `assets/`: imágenes y logos del club

## Arranque local con backend real

1. Asegurate de tener Node instalado.
2. Ejecutá:

```bash
npm start
```

3. Abrí:

- `http://localhost:3000/`
- `http://localhost:3000/admin.html`

## Variables opcionales

- `PORT`: puerto del servidor. Por defecto `3000`
- `HOST`: host del servidor. Por defecto `0.0.0.0`
- `ADMIN_PIN`: PIN del panel admin. Por defecto `TBO2026`
- `ADMIN_SESSION_TTL_MS`: duración de la sesión admin en milisegundos
- `DATA_FILE`: ruta personalizada para guardar la agenda persistente

## Modos de funcionamiento

- `Modo servidor`: cuando corrés `server.js`, la agenda se guarda en `data/schedule-state.json` y queda compartida entre dispositivos.
- `Modo estático`: si abrís los HTML sin backend, la web sigue funcionando con cache local para no romper la versión estática.

## Publicación

GitHub Pages puede publicar la parte estática del sitio, pero no ejecuta el backend Node.

Si querés que el panel y la agenda funcionen con persistencia real en producción, necesitás desplegar `server.js` en un hosting que soporte Node, por ejemplo Render, Railway, Fly.io o un VPS.
