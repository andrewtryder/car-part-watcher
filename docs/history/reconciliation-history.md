# Reconciliation and identity history

This document records superseded rollout and incident context for the active
identity and reconciliation rules.

## Parser and identity cutovers

The semantic-header parser rollout corrected a source-table layout change and
reset derived listing, observation, run, and notification history while
preserving watch definitions and source catalogs. The former v2 identity used
seller, stock, `partGuid`, and part. GUID churn could split one physical item
into multiple durable listings, so v3 excluded `partGuid`.

## Identity collision incident

V3's seller + stock + part tuple was insufficient where a recycler represented
the same stock for multiple vehicles. Result rows then failed with
`LISTING_IDENTITY_COLLISION`. V4 added normalized year and make/model while
continuing to exclude `partGuid`. Its compatibility lookup preserves existing
watch observations when a complete legacy match exists.

## Historical observations

Production baselines and repeats demonstrated the parser/identity changes, but
their watch IDs, listing counts, timings, dates, and rollout revisions are
historical evidence rather than current guarantees. See the active
[reconciliation guide](../reconciliation.md) and
[identity guide](../listing-identity.md) for current behavior.
