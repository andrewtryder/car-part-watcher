# Security

Authentication is intentionally deferred by the owner. The console and its
administrative APIs are currently open for this single-user phase, including
manual execution, scheduling diagnostics, and notification views. Do not treat
the deployment URL as access control. Browserless and database credentials
remain Deno Deploy secrets and are never returned by application APIs or logs.
