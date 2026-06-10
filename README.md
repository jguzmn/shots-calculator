# Shots Calculator

Aplicacion web en espanol para calcular tragos restantes en una botella a partir del peso actual, peso vacio, densidad y tamano del trago.

## Stack actual

- Node.js
- Express
- Neon Postgres
- HTML, CSS y JavaScript vanilla

## Estructura de despliegue

- `public/`: archivos estaticos que Vercel puede servir desde CDN.
- `server.js`: aplicacion Express para desarrollo local y API.
- `api/[...path].js`: entrada serverless para rutas `/api/*` en Vercel.

## Configuracion local

1. Instalar dependencias:

```bash
npm install
```

2. Crear `.env` a partir de `.env.example`:

```bash
DATABASE_URL=postgresql://usuario:password@host/neondb?sslmode=require
PORT=3000
SESSION_SECRET=cadena-larga-aleatoria
DEMO_USER_EMAIL=demo@barraexacta.app
DEMO_USER_PASSWORD=DemoBarraExacta2026!
DEMO_USER_NAME=Usuario Demo
```

La variable `DATABASE_URL` es secreta y no debe subirse al repositorio.
La variable `SESSION_SECRET` firma la cookie de sesion y tambien debe mantenerse privada.

3. Iniciar el servidor:

```bash
npm run dev
```

4. Abrir:

```text
http://localhost:3000
```

## Verificacion

```bash
npm run check
```

## Cargar datos iniciales

Para importar el contenido de `botellas.json` en Neon:

```bash
npm run seed
```

Para crear o actualizar el usuario demo:

```bash
npm run seed:demo-user
```

Credenciales por defecto del demo:

```text
Correo: demo@barraexacta.app
Contraseña: DemoBarraExacta2026!
```

Estas credenciales pueden cambiarse con `DEMO_USER_EMAIL`, `DEMO_USER_PASSWORD` y `DEMO_USER_NAME`.

Para importar el catalogo base recuperado del backup de Supabase en una tabla separada:

```bash
npm run import:catalogo-base
```

Este comando crea o actualiza `catalogo_botellas_base`. No modifica la tabla operativa `botellas`.

## Base de datos

Al iniciar, el servidor crea la tabla `botellas` si no existe.

Campos principales:

- `id`
- `nombre`
- `pesovacio`
- `densidad`
- `created_at`
- `updated_at`

La tabla `catalogo_botellas_base` se reserva para ofrecer un catalogo inicial a futuros clientes.

La tabla `usuarios` guarda usuarios basicos para demo:

- `id`
- `email`
- `nombre`
- `rol`
- `password_hash`
- `activo`
- `created_at`
- `updated_at`

## Despliegue temporal en Vercel

1. Subir los cambios a GitHub.
2. Crear un proyecto nuevo en Vercel importando el repositorio.
3. Configurar la variable de entorno:

```text
DATABASE_URL=postgresql://...
SESSION_SECRET=...
```

4. Crear el usuario demo localmente contra Neon o desde un entorno con las mismas variables:

```bash
npm run seed:demo-user
```

5. Desplegar con la configuracion detectada por Vercel.

Notas:

- No se debe subir `.env`.
- Vercel servira `public/` como archivos estaticos.
- Las rutas `/api/*` se atienden con la funcion `api/[...path].js`.
- Para una publicacion temporal, usar la URL preview de Vercel es suficiente.

## Endpoints

- `GET /api/health`
- `GET /api/botellas`
- `GET /api/botellas/:id`
- `POST /api/botellas`
- `PUT /api/botellas/:id`
- `DELETE /api/botellas/:id`

## Nota de seguridad

La conexion a Neon se hace desde el backend. El navegador nunca debe recibir ni conocer la cadena de conexion de Postgres.
