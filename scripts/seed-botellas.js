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

async function main() {
  await ensureSchema();

  const filePath = path.join(__dirname, "..", "botellas.json");
  const raw = await fs.readFile(filePath, "utf8");
  const botellas = JSON.parse(raw);

  for (const botella of botellas) {
    const nombre = String(botella.nombre || "").trim();
    const pesoVacio = Number(botella.pesoVacio ?? botella.pesovacio);
    const densidad = Number(botella.densidad);

    if (!nombre || !Number.isFinite(pesoVacio) || !Number.isFinite(densidad)) {
      throw new Error(`Botella invalida en ${filePath}: ${JSON.stringify(botella)}`);
    }

    await pool.query(
      `INSERT INTO botellas (nombre, pesovacio, densidad)
       VALUES ($1, $2, $3)
       ON CONFLICT (nombre)
       DO UPDATE SET
         pesovacio = EXCLUDED.pesovacio,
         densidad = EXCLUDED.densidad,
         updated_at = now()`,
      [nombre, pesoVacio, densidad]
    );
  }

  console.log(`Botellas importadas: ${botellas.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
