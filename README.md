# Estudiantes TBÓ

Sitio oficial y panel administrativo del Club Estudiantes TBÓ.

## Estructura

- `index.html`: home pública
- `admin.html`: panel privado para gestionar la agenda
- `style.css`: estilos de la web pública
- `admin.css`: estilos del panel
- `config.js`: configuración del endpoint remoto usado por GitHub Pages
- `schedule-core.js`: lógica compartida de horarios y disciplinas
- `booking-data.js`: store del frontend que consume la API y mantiene un respaldo local
- `cloudflare/worker.mjs`: API para Cloudflare Workers
- `migrations/0001_schedule_schema.sql`: esquema inicial para D1
- `wrangler.toml`: configuración del Worker y binding de D1
- `assets/`: imágenes y logos del club

## Arquitectura

- Frontend público y panel admin: GitHub Pages
- API: Cloudflare Workers
- Base de datos: Cloudflare D1
- Autenticación del panel: token Bearer administrado por el frontend

## Qué se eliminó

- `server.js`
- persistencia en disco local
- dependencia de un backend Node para que la agenda funcione online

## Configuración del Worker

1. Creá una base D1 en Cloudflare.
2. Reemplazá en `wrangler.toml`:
   - `database_id`
   - `preview_database_id`
3. Aplicá la migración:

```bash
wrangler d1 migrations apply estudiantes-tbo
```

4. Configurá el PIN del panel:

```bash
wrangler secret put ADMIN_PIN
```

5. Configurá el origen permitido para GitHub Pages:

```bash
wrangler secret put ALLOWED_ORIGIN
```

Ejemplo de valor:

```text
https://juansum742.github.io
```

Si también vas a usar un dominio personalizado o pruebas locales, podés guardar varios orígenes separados por coma.

## Publicación

1. Desplegá el Worker:

```bash
wrangler deploy
```

2. Copiá la URL resultante, por ejemplo:

```text
https://estudiantes-tbo-api.tu-subdominio.workers.dev
```

3. Pegala en `config.js` dentro de `explicitBase`.

Desde ese momento, la home y `admin.html` dejan de depender del navegador local y usan la misma base compartida desde cualquier dispositivo.

## Deploy automático

El repo ya quedó preparado con un workflow de GitHub Actions en `.github/workflows/deploy-cloudflare-worker.yml`.

Cuando lo actives, cada push a `main` va a:

1. instalar dependencias
2. sincronizar secrets del Worker
3. aplicar migraciones en D1
4. desplegar el Worker automáticamente

Secrets que tenés que cargar en GitHub:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CF_ADMIN_PIN`
- `CF_ALLOWED_ORIGIN`

## Nota importante

Mientras `config.js` siga con `explicitBase` vacío, la web entra en modo de respaldo local y no comparte datos entre dispositivos.
