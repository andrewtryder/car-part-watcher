import type { WatchHealthDto } from "../../../src/contracts/watches.ts";

export const failureMessage = (health?: WatchHealthDto) => {
  if (!health?.lastFailureCode && !health?.lastFailureMessage) return undefined;
  const known: Record<string, string> = {
    REMOTE_BROWSER_DISCONNECTED: "Browser session disconnected",
    ACCESS_CHALLENGE: "Source site blocked the search",
    RUN_TIMEOUT: "Search exceeded the maximum run time",
  };
  return health.lastFailureCode && known[health.lastFailureCode]
    ? known[health.lastFailureCode]
    : health.lastFailureMessage ?? health.lastFailureCode;
};

export function WatchHealthBadge({ health }: { health?: WatchHealthDto }) {
  if (!health || health.status === "never_run") {
    return <span className="badge slate">Never run</span>;
  }
  if (health.status === "failing") {
    return (
      <span className="badge red">
        Failed {health.consecutiveScheduledFailures}{" "}
        scheduled run{health.consecutiveScheduledFailures === 1 ? "" : "s"}
      </span>
    );
  }
  return <span className="badge green">Healthy</span>;
}
