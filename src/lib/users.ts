import { sql } from "@/lib/db";

export type AppUser = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: "admin" | "member";
};

export async function getUserByEmail(email: string): Promise<AppUser | null> {
  const rows = await sql`
    select id, name, email, password_hash as "passwordHash", role
    from users
    where email = ${email.toLowerCase().trim()}
    limit 1
  `;
  return (rows[0] as AppUser | undefined) ?? null;
}

export async function createUser(params: {
  name: string;
  email: string;
  passwordHash: string;
}): Promise<AppUser> {
  const rows = await sql`
    insert into users (name, email, password_hash)
    values (${params.name}, ${params.email.toLowerCase().trim()}, ${params.passwordHash})
    returning id, name, email, password_hash as "passwordHash", role
  `;
  return rows[0] as AppUser;
}
