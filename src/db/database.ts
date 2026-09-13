import postgres from "npm:postgres@3.4.7";

let client: ReturnType<typeof postgres> | undefined;

export function getDatabase() {
  const url = Deno.env.get("DATABASE_URL");
  if (!url) throw new Error("DATABASE_URL is not configured");
  return client ??= postgres(url, { max: 5, idle_timeout: 20 });
}
