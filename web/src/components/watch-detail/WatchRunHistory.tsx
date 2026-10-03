import type { Run } from "../../api.ts";
import { RunStatusBadge } from "../RunStatusBadge.tsx";
import { formatDate, formatDuration } from "../../utils/format.ts";

function SectionError({ retry }: { retry: () => void }) {
  return (
    <p className="notice error">
      Could not load this section.{" "}
      <button type="button" className="quiet inlineButton" onClick={retry}>
        Retry
      </button>
    </p>
  );
}

export function WatchRunHistory({
  runs,
  loading,
  failed,
  timezone,
  onRun,
  retry,
}: {
  runs?: Run[];
  loading: boolean;
  failed: boolean;
  timezone: string;
  onRun: () => void;
  retry: () => void;
}) {
  return (
    <section className="section">
      <div className="sectionHead">
        <div>
          <p className="eyebrow">ACTIVITY</p>
          <h2>Recent Runs</h2>
        </div>
      </div>
      {loading
        ? <div className="skeleton detailSkeleton">Loading recent runs…</div>
        : failed
        ? <SectionError retry={retry} />
        : !runs?.length
        ? (
          <section className="empty">
            <h3>No runs yet.</h3>
            <p>Run this saved search to start collecting results.</p>
            <button type="button" onClick={onRun}>Run now</button>
          </section>
        )
        : (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Started</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Duration</th>
                  <th>Results</th>
                  <th>New</th>
                  <th>Changed</th>
                  <th>Pages</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td>
                      {formatDate(run.startedAt, timezone, {
                        includeYear: true,
                        fallback: "Not available",
                      })}
                    </td>
                    <td>
                      {run.runType === "scheduled" ? "Scheduled" : "Manual"}
                    </td>
                    <td>
                      <RunStatusBadge status={run.status} />
                      {run.status === "failed" &&
                        (run.errorCode || run.errorMessage) && (
                        <details>
                          <summary>Error details</summary>
                          <p>
                            {[run.errorCode, run.errorMessage].filter(Boolean)
                              .join(": ")}
                          </p>
                        </details>
                      )}
                    </td>
                    <td>{formatDuration(run)}</td>
                    <td>{run.listingCount ?? "—"}</td>
                    <td>{run.newListingCount ?? "—"}</td>
                    <td>{run.changedCount ?? "—"}</td>
                    <td>{run.pagesFetched ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </section>
  );
}
