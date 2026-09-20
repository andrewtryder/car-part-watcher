# Listing identity

A listing identity must remain stable when Car-Part changes presentation or
opaque request identifiers. The durable identity is intentionally based on
seller inventory, not on result order, price, description, grade, image URLs,
or transient/session values.

## Observed candidates

The representative headed-Chrome/Xvfb search was run in two fresh browser
sessions. Each returned 50 first-page listings.

| Candidate                                      | Run 1 / run 2 coverage | Collisions per run | Overlap | Missing per run |
| ---------------------------------------------- | ---------------------: | -----------------: | ------: | --------------: |
| `partGuid`                                     |                22 / 22 |            17 / 17 |      22 |         28 / 28 |
| `sellerUserId + stockNumber`                   |                48 / 48 |              0 / 0 |      48 |           2 / 2 |
| `sellerUserId + stockNumber + normalized part` |                48 / 48 |              0 / 0 |      48 |           2 / 2 |
| recycler + stock + vehicle + normalized part   |                50 / 50 |              0 / 0 |      50 |           0 / 0 |

Stock number is recycler-scoped rather than globally unique, so seller identity
remains part of the key.

## Current strategy — identity v3

The primary identity is:

`sellerUserId + normalized stockNumber + normalized part`

The durable application key is
`car-part:v3:sha256:<digest>` over that canonical identity and records
`seller_stock_part` as the method.

`partGuid` is deliberately excluded. A production notification incident on
2026-09-20 showed the same physical stock item appearing repeatedly while the
opaque Car-Part GUID was not safe to treat as inventory identity. Price,
description, grade, recycler contact details, photos, and quote URLs also remain
mutable metadata rather than identity fields.

Rows missing seller, stock number, or part are skipped rather than assigned a
weaker production identity. `fallbackIdentity` remains available only for
diagnostics.

## Compatibility with identity v2

Identity v2 included `partGuid`, so changing the key formula without a
compatibility path would make all established inventory appear new.

During reconciliation, when a v3 source key is not present, the repository
looks for an existing Car-Part row with the same seller, stock number, and part.
If historical GUID churn produced several legacy rows, it prefers a row already
associated with the current watch and then the oldest row. Reusing that listing
ID preserves the existing `watch_listings` relationship and prevents a
deployment-time notification flood.

Legacy source-key strings can therefore coexist with v3 keys. New inventory is
written with v3 keys; established rows are recognized through the compatibility
lookup.
