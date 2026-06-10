const fs = require("node:fs/promises");
const path = require("node:path");
const { Pool } = require("pg");
require("dotenv").config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Falta DATABASE_URL. Crea un archivo .env basado en .env.example.");
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
});

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS catalogo_botellas_base (
      id BIGSERIAL PRIMARY KEY,
      nombre TEXT NOT NULL UNIQUE,
      pesovacio NUMERIC(10, 2) NOT NULL CHECK (pesovacio > 0),
      densidad NUMERIC(8, 4) NOT NULL CHECK (densidad > 0),
      activo BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function main() {
  await ensureSchema();

  const filePath = path.join(__dirname, "..", "data", "catalogo-botellas-base.json");
  const raw = await fs.readFile(filePath, "utf8");
  const catalogo = JSON.parse(raw);

  for (const botella of catalogo) {
    const nombre = String(botella.nombre || "").trim();
    const pesoVacio = Number(botella.pesoVacio);
    const densidad = Number(botella.densidad);

    if (!nombre || !Number.isFinite(pesoVacio) || !Number.isFinite(densidad)) {
      throw new Error(`Botella invalida en catalogo base: ${JSON.stringify(botella)}`);
    }

    await pool.query(
      `INSERT INTO catalogo_botellas_base (nombre, pesovacio, densidad)
       VALUES ($1, $2, $3)
       ON CONFLICT (nombre)
       DO UPDATE SET
         pesovacio = EXCLUDED.pesovacio,
         densidad = EXCLUDED.densidad,
         activo = true,
         updated_at = now()`,
      [nombre, pesoVacio, densidad]
    );
  }

  console.log(`Catalogo base importado: ${catalogo.length} botellas`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
