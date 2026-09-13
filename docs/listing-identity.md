# Listing identity

## Two-session observation

The representative headed-Chrome/Xvfb search was run in two fresh browser
sessions. Each returned 50 first-page listings. This is a short, same-day
observation, not proof that any source field is globally permanent.

| Candidate                                      | Run 1 / run 2 coverage | Collisions per run | Overlap | Missing per run |
| ---------------------------------------------- | ---------------------: | -----------------: | ------: | --------------: |
| `partGuid`                                     |                22 / 22 |            17 / 17 |      22 |         28 / 28 |
| `sellerUserId + stockNumber`                   |                48 / 48 |              0 / 0 |      48 |           2 / 2 |
| `partSourceId + stockNumber`                   |                22 / 22 |            17 / 17 |      22 |         28 / 28 |
| `sellerUserId + stockNumber + normalized part` |                48 / 48 |              0 / 0 |      48 |           2 / 2 |
| recycler + stock + vehicle + normalized part   |                50 / 50 |              0 / 0 |      50 |           0 / 0 |

There were no apparent additions/removals across the two runs and no observed
price, description, or grade changes among the overlapping candidates.
`partGuid` and `partSourceId + stockNumber` are unsuitable in this sample due to
collisions. The implementation deliberately excludes result order, distance,
price, description, grade, and missing price from keys.

## Current strategy

- Primary: `sellerUserId + normalized stockNumber + normalized part`.
- Fallback: normalized recycler name + normalized stock number + vehicle year +
  normalized make/model + normalized part.

The fallback makes the observed sample complete. Its tradeoff is that a recycler
rename, stock-number reuse, or corrected vehicle text can split a real listing.
The primary can likewise split when Car-Part omits or changes seller identity.
Neither candidate has yet been tested across inventory turnover, searches with
different scopes, or a long time range. Source-key collisions and any future
identity migration must be treated as data-quality events, not silently merged.

The durable application key is `car-part:v1:sha256:<digest>` over a canonical
UTF-8 identity string and records `seller_stock_part` or `fallback_composite`
as its internal confidence method. It is not derived from mutable display
values or opaque Car-Part session values.
