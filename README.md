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
- `migrations/0002_admin_security.sql`: endurecimiento del panel admin, sesiones y rate limit
- `wrangler.toml`: configuración del Worker y binding de D1
- `scripts/generate-admin-password-hash.mjs`: utilitario para generar el hash seguro de la clave admin
- `assets/`: imágenes y logos del club

## Arquitectura

- Producción segura recomendada:
  - mismo Worker de Cloudflare sirviendo `index.html`, `admin.html`, CSS, JS, assets y `/api/*`
  - base de datos en Cloudflare D1
  - autenticación del panel con hash PBKDF2 validado solo en backend
  - sesión admin por cookie segura `HttpOnly`, `Secure`, `SameSite=Strict`
- GitHub Pages puede seguir funcionando como espejo público.
- El acceso al panel admin queda redirigido al sitio seguro del Worker para evitar autenticación cross-site.
- La URL canónica del panel seguro es `/admin`.

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

4. Generá el hash seguro de la clave admin:

```bash
npm run security:hash-admin -- "tu-clave-admin"
```

5. Guardá ese hash en Cloudflare:

```bash
wrangler secret put ADMIN_PASSWORD_HASH
```

6. Generá un pepper aleatorio para sesiones y rate limit:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

7. Guardalo en Cloudflare:

```bash
wrangler secret put AUTH_PEPPER
```

8. Configurá el origen permitido para GitHub Pages o cualquier mirror público cross-origin:

```bash
wrangler secret put ALLOWED_ORIGIN
```

Ejemplo de valor:

```text
https://juansum742.github.io
```

Si también vas a usar un dominio personalizado o pruebas locales, podés guardar varios orígenes separados por coma.

## Sesión admin segura

- El panel ya no guarda tokens de sesión en `localStorage` ni `sessionStorage`.
- El login del panel emite una cookie segura de backend:
  - `HttpOnly`
  - `Secure`
  - `SameSite=Strict`
  - `Path=/api`
- Los endpoints privados validan la cookie en el Worker y nunca devuelven el valor de sesión al frontend.

## Publicación

1. Desplegá el Worker:

```bash
wrangler deploy
```

2. Copiá la URL resultante, por ejemplo:

```text
https://estudiantes-tbo-api.tu-subdominio.workers.dev
```

3. Pegala en `config.js` dentro de `explicitAppBase`.

Desde ese momento:

- la URL del Worker puede servir la home y el panel en el mismo origen
- `admin.html` ya puede usar cookie `HttpOnly` real
- la home pública y el panel usan la misma base compartida desde cualquier dispositivo
- GitHub Pages puede seguir mostrando la home, pero el acceso al panel se redirige al origen seguro del Worker

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
- `CF_ADMIN_PASSWORD_HASH`
- `CF_AUTH_PEPPER`
- `CF_ALLOWED_ORIGIN`

## Dominio recomendado

La arquitectura más segura para producción es:

- `https://gymtbo.com/`
- `https://gymtbo.com/admin`
- `https://gymtbo.com/api/...`

Mientras configurás el dominio final, podés usar directamente la URL del Worker `workers.dev` como origen seguro único.

## Nota importante

Mientras `config.js` siga con `explicitAppBase` vacío, la web entra en modo de respaldo local y no comparte datos entre dispositivos.
