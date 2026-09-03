// Aplica db/schema.sql no banco apontado por DATABASE_URL.
// Uso: npm run db:migrate  (lê DATABASE_URL de .env.local)
import { Client } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "DATABASE_URL não encontrada.\n" +
        "Crie um arquivo .env.local na raiz do projeto com:\n" +
        "  DATABASE_URL=postgresql://...  (connection string do Neon)\n" +
        "e rode novamente: npm run db:migrate"
    );
    process.exit(1);
  }

  const schemaPath = path.join(__dirname, "..", "db", "schema.sql");
  const schemaSql = readFileSync(schemaPath, "utf8");

  const client = new Client(url);
  await client.connect();
  try {
    console.log("Aplicando db/schema.sql...");
    await client.query(schemaSql);
    console.log("✔ Schema aplicado com sucesso.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("✗ Erro ao aplicar schema:", err.message || err);
  process.exit(1);
});
