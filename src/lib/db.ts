import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// Instância criada sob demanda (não no carregamento do módulo) para que
// rotas que importam este arquivo não quebrem o build quando DATABASE_URL
// ainda não está definida (ex.: build sem acesso ao banco).
let client: NeonQueryFunction<false, false> | null = null;

function getClient(): NeonQueryFunction<false, false> {
  if (client) return client;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL não configurada. Configure a variável de ambiente com a connection string do Neon (Vercel > Settings > Environment Variables)."
    );
  }
  client = neon(connectionString);
  return client;
}

/**
 * Cliente SQL serverless do Neon. Usa HTTP por baixo dos panos, então funciona
 * bem em funções serverless da Vercel (sem pool de conexões TCP para gerenciar).
 *
 * Uso: await sql`SELECT * FROM clients WHERE active = true`
 */
export function sql(
  strings: TemplateStringsArray,
  ...values: unknown[]
): ReturnType<NeonQueryFunction<false, false>> {
  return getClient()(strings, ...values);
}
