import postgres from "npm:postgres@3.4.7";

export type Sql = ReturnType<typeof postgres>;

let client: Sql | undefined;

export function getDatabase() {
  const url = Deno.env.get("DATABASE_URL");
  if (!url) throw new Error("DATABASE_URL is not configured");
  return client ??= postgres(url, { max: 5, idle_timeout: 20 });
}
