const path = require("node:path");
const express = require("express");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Falta DATABASE_URL. Crea un archivo .env basado en .env.example.");
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
});

app.use(express.json());

const publicFiles = new Set([
  "index.html",
  "style.css",
  "api-client.js",
  "calculator.js",
  "script.js",
  "botellas.html",
  "botellas.js",
  "botella-form.html",
  "botella-form.js"
]);

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
    return { error: "El peso vacio debe ser mayor que cero." };
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
  `);
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

app.get("/api/health", asyncHandler(async (_req, res) => {
  await pool.query("SELECT 1");
  res.json({ ok: true });
}));

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

app.put("/api/botellas/:id", asyncHandler(async (req, res) => {
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
}));

app.delete("/api/botellas/:id", asyncHandler(async (req, res) => {
  const result = await pool.query("DELETE FROM botellas WHERE id = $1", [req.params.id]);

  if (!result.rowCount) {
    res.status(404).json({ message: "Botella no encontrada." });
    return;
  }

  res.status(204).send();
}));

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/:file", (req, res, next) => {
  if (!publicFiles.has(req.params.file)) {
    next();
    return;
  }

  res.sendFile(path.join(__dirname, req.params.file));
});

app.use((req, res) => {
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
    res.status(400).json({ message: "Los datos de la botella no son validos." });
    return;
  }

  console.error(error);
  res.status(500).json({ message: "Ocurrio un error inesperado." });
});

ensureSchema()
  .then(() => {
    app.listen(port, () => {
      console.log(`Servidor iniciado en http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("No se pudo inicializar la base de datos.", error);
    process.exit(1);
  });
