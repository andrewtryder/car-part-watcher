import { getDatabase } from "../src/db/database.ts";

const sql = getDatabase();
await sql`create table if not exists schema_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
)`;
for (
  const entry of [...Deno.readDirSync("migrations")].filter((entry) =>
    entry.isFile
  ).sort((a, b) => a.name.localeCompare(b.name))
) {
  const applied =
    await sql`select 1 from schema_migrations where name = ${entry.name}`;
  if (applied.length) continue;
  const migration = await Deno.readTextFile(`migrations/${entry.name}`);
  await sql.begin(async (tx) => {
    await tx.unsafe(migration);
    await tx`insert into schema_migrations (name) values (${entry.name})`;
  });
  console.log(`applied ${entry.name}`);
}
await sql.end();
