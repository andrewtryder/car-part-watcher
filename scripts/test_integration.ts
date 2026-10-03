const container = `car-part-watcher-integration-${
  crypto.randomUUID().slice(0, 8)
}`;
const port = "55432";
const databaseUrl = `postgres://postgres:postgres@127.0.0.1:${port}/watcher`;
const legacyUrl = `postgres://postgres:postgres@127.0.0.1:${port}/legacy`;

async function command(command: string, args: string[], env = {}) {
  const result = await new Deno.Command(command, {
    args,
    env: { ...Deno.env.toObject(), ...env },
    stdout: "inherit",
    stderr: "inherit",
  }).output();
  if (!result.success) throw new Error(`${command} ${args.join(" ")} failed`);
}

try {
  await command("docker", [
    "run",
    "-d",
    "--rm",
    "--name",
    container,
    "-e",
    "POSTGRES_PASSWORD=postgres",
    "-e",
    "POSTGRES_DB=watcher",
    "-p",
    `127.0.0.1:${port}:5432`,
    "postgres:16-alpine",
  ]);
  for (let attempt = 0; attempt < 30; attempt++) {
    const ready = await new Deno.Command("docker", {
      args: ["exec", container, "pg_isready", "-U", "postgres"],
      stdout: "null",
      stderr: "null",
    }).output();
    if (ready.success) break;
    if (attempt === 29) {
      throw new Error("Disposable PostgreSQL did not become ready");
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  await command("docker", [
    "exec",
    container,
    "createdb",
    "-U",
    "postgres",
    "legacy",
  ]);
  const env = { DATABASE_URL: databaseUrl, LEGACY_DATABASE_URL: legacyUrl };
  await command("deno", [
    "run",
    "--allow-env",
    "--allow-net",
    "--allow-read",
    "scripts/migrate.ts",
  ], env);
  await command("deno", [
    "test",
    "--allow-env",
    "--allow-net",
    "--allow-read",
    "tests/reconciliation_test.ts",
    "tests/notification_outbox_test.ts",
    "tests/notification_migration_test.ts",
  ], env);
} finally {
  await new Deno.Command("docker", {
    args: ["rm", "-f", container],
    stdout: "inherit",
    stderr: "inherit",
  }).output();
}
