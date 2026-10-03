import type { Run } from "../api.ts";

export const runStatusLabel = (status: Run["status"]) =>
  status === "succeeded"
    ? "Succeeded"
    : status === "failed"
    ? "Failed"
    : "Running";

export const runStatusTone = (status: Run["status"]) =>
  status === "succeeded" ? "green" : status === "failed" ? "red" : "amber";

export function RunStatusBadge({ status }: { status: Run["status"] }) {
  return (
    <span className={`badge ${runStatusTone(status)}`}>
      {runStatusLabel(status)}
    </span>
  );
}
