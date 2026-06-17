# Despliegue - BarraExacta

Este documento resume la configuracion necesaria para operar BarraExacta en Vercel con Neon Postgres.

## Entorno actual

- Frontend estatico en `public/`.
- API Express en `server.js`.
- Entrada serverless en `api/[...path].js`.
- Base de datos Neon Postgres.
- Variables de entorno en `.env` local y en Vercel.

## Variables requeridas

Configurar localmente en `.env` y en Vercel:

```text
DATABASE_URL
SESSION_SECRET
NODE_ENV
```

Variables opcionales para seeds:

```text
DEMO_USER_EMAIL
DEMO_USER_PASSWORD
DEMO_USER_NAME
DEMO_CLIENT_NAME
DEMO_CLIENT_SLUG
ADMIN_USER_EMAIL
ADMIN_USER_PASSWORD
ADMIN_USER_NAME
ADMIN_CLIENT_NAME
ADMIN_CLIENT_SLUG
```

## Comandos

Instalar dependencias:

```bash
npm install
```

Ejecutar local:

```bash
npm run dev
```

Validar sintaxis:

```bash
npm run check
```

Crear usuario demo:

```bash
npm run seed:demo-user
```

Crear super admin:

```bash
npm run seed:admin-user
```

Importar catalogo base:

```bash
npm run import:catalogo-base
```

## Checklist post-despliegue

- Confirmar que `/api/health` responde.
- Confirmar login y logout.
- Confirmar que `/api/auth/me` devuelve el usuario actual.
- Confirmar que Calculadora lista botellas del cliente.
- Confirmar que el calculo registra medicion.
- Confirmar que Historial muestra mediciones.
- Confirmar que los filtros de Historial funcionan.
- Confirmar que CSV respeta filtros.
- Confirmar que `usuario_cliente` no ve modulos administrativos.
- Confirmar que `admin_cliente` administra usuarios de su cliente.
- Confirmar que `super_admin` administra clientes y usuarios.
- Confirmar que retirar una botella con historial la deja inactiva.

## Seguridad operativa

- No subir `.env` al repositorio.
- No exponer `DATABASE_URL` en frontend.
- Rotar credenciales si fueron compartidas por error.
- Usar un `SESSION_SECRET` fuerte en Vercel.
- Revisar logs de Vercel despues de cambios de backend.

