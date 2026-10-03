# Historical production verification

This record preserves dated rollout evidence that is not part of the active
architecture contract.

## 2026-09-13 deployment and console verification

Production deployment used the source-controlled pre-deploy migration command.
Catalog, watch create/edit/enable/disable/delete, listing reconciliation,
baseline notification suppression, and the React console were exercised against
representative watches. The recorded runs demonstrated persistence across a
revision change and that a repeated successful result set did not create new
watch/listing relationships.

The managed-database CLI query endpoint returned an upstream procedure-not-found
error during this exercise, so schema verification used normal persisted catalog
and watch operations instead. No diagnostic endpoint was added.

The same rollout established that `notify_on_initial_run=false` suppressed
notification creation during real baseline runs. Historical watch identifiers,
listing counts, timings, deployment revisions, and future-execution notes were
removed from active documentation because they are not current guarantees.

## Notes

This record is evidence only. Current behavior, migration requirements, and
notification-state semantics are specified by the active docs and tests.
