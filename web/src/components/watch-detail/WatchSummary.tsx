import { Link } from "react-router-dom";
import type { Watch } from "../../api.ts";
import { failureMessage, WatchHealthBadge } from "../WatchHealthBadge.tsx";
import { formatDate } from "../../utils/format.ts";

const frequency: Record<number, string> = {
  1: "Once daily",
  2: "Twice daily",
  3: "Three times daily",
};

export function WatchSummary({
  item,
  timezone,
  running,
  onRun,
  onToggle,
  onDelete,
}: {
  item: Watch;
  timezone: string;
  running: boolean;
  onRun: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <header className="detailHeader">
        <div className="headerTitleGroup">
          <p className="eyebrow">SAVED SEARCH</p>
          <h1>{item.name}</h1>
          <p className="criteria">
            {[item.year, item.makeModel, item.part].filter(Boolean).join(" · ")}
          </p>
          <p className="muted">
            {item.location || "Any location"}
            {item.refinement?.label ? ` · ${item.refinement.label}` : ""}
          </p>
          <div className="badges">
            <span className={`badge ${item.enabled ? "green" : "slate"}`}>
              {item.enabled ? "Enabled" : "Disabled"}
            </span>
            <span
              className={`badge ${item.scheduleEnabled ? "blue" : "slate"}`}
            >
              {item.scheduleEnabled ? "Scheduled" : "Unscheduled"}
            </span>
            {item.scheduleEnabled && (
              <span className="badge blue">{frequency[item.runFrequency]}</span>
            )}
          </div>
          <p className="muted">Timezone: {timezone}</p>
        </div>
        <div className="detailActions">
          <button type="button" onClick={onRun} disabled={running}>
            {running ? "Running search…" : "Run now"}
          </button>
          <Link className="buttonLink quiet" to={`/watches/${item.id}/edit`}>
            Edit
          </Link>
          <Link
            className="buttonLink quiet"
            to={`/new-parts?watchId=${item.id}`}
          >
            View new parts
          </Link>
          <button type="button" className="quiet" onClick={onToggle}>
            {item.enabled ? "Disable" : "Enable"}
          </button>
          <button type="button" className="danger" onClick={onDelete}>
            Delete
          </button>
        </div>
      </header>
      <section className="section operationalStatus">
        <div className="sectionHead">
          <h2>Operational Status</h2>
          <WatchHealthBadge health={item.health} />
        </div>
        <dl>
          <div>
            <dt>Last successful run</dt>
            <dd>
              {formatDate(item.health?.lastSuccessfulAt, timezone, {
                fallback: "Not available",
              })}
            </dd>
          </div>
          <div>
            <dt>Last scheduled attempt</dt>
            <dd>
              {formatDate(item.health?.lastScheduledRunAt, timezone, {
                fallback: "Not available",
              })}
            </dd>
          </div>
          <div>
            <dt>Consecutive scheduled failures</dt>
            <dd>{item.health?.consecutiveScheduledFailures ?? 0}</dd>
          </div>
          <div>
            <dt>Latest failure</dt>
            <dd>
              {failureMessage(item.health) ?? "None"}
              {item.health?.lastFailureCode
                ? ` (${item.health.lastFailureCode})`
                : ""}
            </dd>
          </div>
        </dl>
        <Link className="accentLink" to={`/runs?watch=${item.id}`}>
          View run history
        </Link>
      </section>
    </>
  );
}
