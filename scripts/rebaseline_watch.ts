import { applyRebaseline, planRebaseline } from "../src/services/rebaseline_service.ts";

const [watchId, flag] = Deno.args;
if (!watchId) throw new Error("Usage: deno task rebaseline-watch -- <watch-id> [--apply]");
if (flag && flag !== "--apply") throw new Error("Only --apply is accepted");
const plan = flag === "--apply" ? await applyRebaseline(watchId) : await planRebaseline(watchId);
console.log(JSON.stringify({ mode: flag === "--apply" ? "applied" : "dry-run", ...plan }, null, 2));
