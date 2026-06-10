const path = require("node:path");
const express = require("express");
const { Pool } = require("pg");
const { signSession, verifyPassword, verifySession } = require("./lib/auth-utils");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;
const databaseUrl = process.env.DATABASE_URL;
const sessionSecret =
  process.env.SESSION_SECRET ||
  (process.env.NODE_ENV === "production" ? "" : "barraexacta-dev-session-secret");
const sessionCookieName = "barraexacta_session";
const sessionDurationMs = 12 * 60 * 60 * 1000;

if (!databaseUrl) {
  throw new Error("Falta DATABASE_URL. Crea un archivo .env basado en .env.example.");
}

if (!sessionSecret) {
  throw new Error("Falta SESSION_SECRET. Configuralo como variable de entorno.");
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
});

let schemaReady;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function mapBotella(row) {
  return {
    id: row.id,
    nombre: row.nombre,
    pesoVacio: Number(row.pesovacio),
    densidad: Number(row.densidad)
  };
}

function validateBotella(input) {
  const nombre = String(input.nombre || "").trim();
  const pesoVacio = Number(input.pesoVacio);
  const densidad = Number(input.densidad);

  if (!nombre) return { error: "El nombre es obligatorio." };
  if (!Number.isFinite(pesoVacio) || pesoVacio <= 0) {
    return { error: "El peso vacío debe ser mayor que cero." };
  }
  if (!Number.isFinite(densidad) || densidad <= 0) {
    return { error: "La densidad debe ser mayor que cero." };
  }

  return { data: { nombre, pesoVacio, densidad } };
}

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS botellas (
      id BIGSERIAL PRIMARY KEY,
      nombre TEXT NOT NULL UNIQUE,
      pesovacio NUMERIC(10, 2) NOT NULL CHECK (pesovacio > 0),
      densidad NUMERIC(8, 4) NOT NULL CHECK (densidad > 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS usuarios (
      id BIGSERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      nombre TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'demo',
      password_hash TEXT NOT NULL,
      activo BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email_lower_unique
      ON usuarios (lower(email));
  `);
}

function ensureSchemaOnce() {
  if (!schemaReady) {
    schemaReady = ensureSchema();
  }

  return schemaReady;
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function parseCookies(cookieHeader = "") {
  return cookieHeader.split(";").reduce((cookies, pair) => {
    const [name, ...valueParts] = pair.trim().split("=");

    if (name) {
      cookies[name] = decodeURIComponent(valueParts.join("="));
    }

    return cookies;
  }, {});
}

function getSessionCookieOptions() {
  const secure = process.env.NODE_ENV === "production";

  return [
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${Math.floor(sessionDurationMs / 1000)}`,
    secure ? "Secure" : ""
  ]
    .filter(Boolean)
    .join("; ");
}

function setSessionCookie(res, user) {
  const token = signSession(
    {
      sub: user.id,
      email: user.email,
      nombre: user.nombre,
      rol: user.rol,
      exp: Date.now() + sessionDurationMs
    },
    sessionSecret
  );

  res.setHeader("Set-Cookie", `${sessionCookieName}=${encodeURIComponent(token)}; ${getSessionCookieOptions()}`);
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${sessionCookieName}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${
      process.env.NODE_ENV === "production" ? "; Secure" : ""
    }`
  );
}

function getSession(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  return verifySession(cookies[sessionCookieName], sessionSecret);
}

function requireAuth(req, res, next) {
  const session = getSession(req);

  if (!session) {
    res.status(401).json({ message: "Debes iniciar sesión." });
    return;
  }

  req.user = session;
  next();
}

app.use("/api", asyncHandler(async (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  await ensureSchemaOnce();
  next();
}));

app.get("/api/health", asyncHandler(async (_req, res) => {
  await pool.query("SELECT 1");
  res.json({ ok: true });
}));

app.get("/api/auth/me", (req, res) => {
  const session = getSession(req);

  if (!session) {
    res.status(401).json({ message: "No hay sesión activa." });
    return;
  }

  res.json({
    user: {
      id: session.sub,
      email: session.email,
      nombre: session.nombre,
      rol: session.rol
    }
  });
});

app.post("/api/auth/login", asyncHandler(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!email || !password) {
    res.status(400).json({ message: "Ingresa correo y contraseña." });
    return;
  }

  const { rows } = await pool.query(
    `SELECT id, email, nombre, rol, password_hash
     FROM usuarios
     WHERE lower(email) = lower($1)
       AND activo = true
     LIMIT 1`,
    [email]
  );

  const user = rows[0];

  if (!user || !verifyPassword(password, user.password_hash)) {
    res.status(401).json({ message: "Correo o contraseña inválidos." });
    return;
  }

  setSessionCookie(res, user);
  res.json({
    user: {
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      rol: user.rol
    }
  });
}));

app.post("/api/auth/logout", (req, res) => {
  clearSessionCookie(res);
  res.status(204).send();
});

app.use("/api/botellas", requireAuth);

app.get("/api/botellas", asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(
    "SELECT id, nombre, pesovacio, densidad FROM botellas ORDER BY nombre ASC"
  );
  res.json(rows.map(mapBotella));
}));

app.get("/api/botellas/:id", asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, nombre, pesovacio, densidad FROM botellas WHERE id = $1",
    [req.params.id]
  );

  if (!rows.length) {
    res.status(404).json({ message: "Botella no encontrada." });
    return;
  }

  res.json(mapBotella(rows[0]));
}));

app.post("/api/botellas", asyncHandler(async (req, res) => {
  const validation = validateBotella(req.body);
  if (validation.error) {
    res.status(400).json({ message: validation.error });
    return;
  }

  const { nombre, pesoVacio, densidad } = validation.data;
  const { rows } = await pool.query(
    `INSERT INTO botellas (nombre, pesovacio, densidad)
     VALUES ($1, $2, $3)
     RETURNING id, nombre, pesovacio, densidad`,
    [nombre, pesoVacio, densidad]
  );

  res.status(201).json(mapBotella(rows[0]));
}));

async function actualizarBotella(req, res) {
  const validation = validateBotella(req.body);
  if (validation.error) {
    res.status(400).json({ message: validation.error });
    return;
  }

  const { nombre, pesoVacio, densidad } = validation.data;
  const { rows } = await pool.query(
    `UPDATE botellas
     SET nombre = $1,
         pesovacio = $2,
         densidad = $3,
         updated_at = now()
     WHERE id = $4
     RETURNING id, nombre, pesovacio, densidad`,
    [nombre, pesoVacio, densidad, req.params.id]
  );

  if (!rows.length) {
    res.status(404).json({ message: "Botella no encontrada." });
    return;
  }

  res.json(mapBotella(rows[0]));
}

async function eliminarBotellaPorId(req, res) {
  const result = await pool.query("DELETE FROM botellas WHERE id = $1", [req.params.id]);

  if (!result.rowCount) {
    res.status(404).json({ message: "Botella no encontrada." });
    return;
  }

  res.status(204).send();
}

app.put("/api/botellas/:id", asyncHandler(actualizarBotella));
app.post("/api/botellas/:id/actualizar", asyncHandler(actualizarBotella));
app.delete("/api/botellas/:id", asyncHandler(eliminarBotellaPorId));
app.post("/api/botellas/:id/eliminar", asyncHandler(eliminarBotellaPorId));

app.use("/api", (req, res) => {
  res.status(404).json({ message: "Recurso no encontrado." });
});

app.use((error, _req, res, _next) => {
  const duplicateName = error.code === "23505";
  const checkViolation = error.code === "23514";

  if (duplicateName) {
    res.status(409).json({ message: "Ya existe una botella con ese nombre." });
    return;
  }

  if (checkViolation) {
    res.status(400).json({ message: "Los datos de la botella no son válidos." });
    return;
  }

  console.error(error);
  res.status(500).json({ message: "Ocurrió un error inesperado." });
});

if (require.main === module) {
  ensureSchemaOnce()
    .then(() => {
      app.listen(port, () => {
        console.log(`Servidor iniciado en http://localhost:${port}`);
      });
    })
    .catch((error) => {
      console.error("No se pudo inicializar la base de datos.", error);
      process.exit(1);
    });
}

module.exports = app;
