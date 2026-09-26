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

## Current strategy — identity v4

The primary identity is:

`sellerUserId + normalized stockNumber + normalized year + normalized makeModel + normalized part`

The durable application key is
`car-part:v4:sha256:<digest>` over that canonical identity and records
`seller_stock_vehicle_part` as the method.

`partGuid` remains deliberately excluded. A production notification incident
on 2026-09-20 showed the same physical stock item appearing repeatedly while the
opaque Car-Part GUID changed. A second production incident beginning 2026-09-21
showed that seller + stock + part alone can also identify more than one visible
vehicle, causing `LISTING_IDENTITY_COLLISION` failures. Vehicle year and
make/model are therefore included to disambiguate recycler stock that is reused
or represented by multiple vehicles.

Price, description, grade, recycler contact details, photos, quote URLs, and
opaque GUIDs remain mutable metadata rather than identity fields. Rows missing
seller, stock number, year, make/model, or part are skipped rather than assigned
a weaker production identity. `fallbackIdentity` remains available only for
diagnostics.

## Compatibility with identity v2 and v3

Identity v2 included `partGuid`; identity v3 used seller + stock + part.
Changing the key formula without a compatibility path would make established
inventory appear new.

During reconciliation, when a v4 source key is not present, the repository looks
for an existing Car-Part row with the same seller, stock number, year,
make/model, and part. If historical GUID churn produced several matching legacy
rows, it prefers a row already associated with the current watch and then the
oldest row. Reusing that listing ID preserves the existing `watch_listings`
relationship while avoiding a merge between distinct vehicles sharing the same
seller + stock + part tuple.

Legacy source-key strings can therefore coexist with v4 keys. New inventory is
written with v4 keys; established rows are recognized through the compatibility
lookup.
