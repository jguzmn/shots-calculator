const fs = require("node:fs/promises");
const path = require("node:path");
const { Pool } = require("pg");
require("dotenv").config();

const databaseUrl = process.env.DATABASE_URL;
const demoClientName = process.env.DEMO_CLIENT_NAME || "Cliente Demo";
const demoClientSlug = process.env.DEMO_CLIENT_SLUG || "demo";

if (!databaseUrl) {
  throw new Error("Falta DATABASE_URL. Crea un archivo .env basado en .env.example.");
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
});

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clientes (
      id BIGSERIAL PRIMARY KEY,
      nombre TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      activo BOOLEAN NOT NULL DEFAULT true,
      tamano_trago_default NUMERIC(8, 2) NOT NULL DEFAULT 60,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS botellas (
      id BIGSERIAL PRIMARY KEY,
      nombre TEXT NOT NULL UNIQUE,
      pesovacio NUMERIC(10, 2) NOT NULL CHECK (pesovacio > 0),
      densidad NUMERIC(8, 4) NOT NULL CHECK (densidad > 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    ALTER TABLE botellas ADD COLUMN IF NOT EXISTS cliente_id BIGINT;
    ALTER TABLE botellas ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE botellas ADD COLUMN IF NOT EXISTS categoria TEXT;
    ALTER TABLE botellas ADD COLUMN IF NOT EXISTS volumen_ml NUMERIC(10, 2);
  `);
}

async function main() {
  await ensureSchema();
  const client = await pool.query(
    `INSERT INTO clientes (nombre, slug)
     VALUES ($1, $2)
     ON CONFLICT (slug)
     DO UPDATE SET nombre = EXCLUDED.nombre, updated_at = now()
     RETURNING id`,
    [demoClientName, demoClientSlug]
  );
  const clientId = client.rows[0].id;

  await pool.query("UPDATE botellas SET cliente_id = $1 WHERE cliente_id IS NULL", [clientId]);
  await pool.query("ALTER TABLE botellas ALTER COLUMN cliente_id SET NOT NULL");
  await pool.query("ALTER TABLE botellas DROP CONSTRAINT IF EXISTS botellas_nombre_key");
  await pool.query(
    "CREATE UNIQUE INDEX IF NOT EXISTS botellas_cliente_nombre_lower_unique ON botellas (cliente_id, lower(nombre))"
  );

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
      `INSERT INTO botellas (cliente_id, nombre, pesovacio, densidad)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (cliente_id, lower(nombre))
       DO UPDATE SET
         pesovacio = EXCLUDED.pesovacio,
         densidad = EXCLUDED.densidad,
         activo = true,
         updated_at = now()`,
      [clientId, nombre, pesoVacio, densidad]
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
