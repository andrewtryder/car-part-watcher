# Listing identity

A durable identity must survive presentation and opaque-identifier changes. The
application uses the normalized tuple:

`sellerUserId + stockNumber + year + makeModel + part`

It stores `car-part:v4:sha256:<digest>` with the `seller_stock_vehicle_part`
method. Seller identity is required because stock numbers are recycler-scoped.
Price, description, grade, recycler details, image/quote URLs, result order,
transient values, and `partGuid` are mutable metadata, not identity.

Rows lacking seller, stock number, year, make/model, or part are skipped rather
than assigned a weaker identity. `fallbackIdentity` is diagnostics-only.

## Legacy compatibility

Historical v2 keys included `partGuid`; v3 keys used seller, stock, and part.
When a v4 key is absent, reconciliation finds an existing row with matching
seller, stock, vehicle, and part, preferring one associated with the watch and
then the oldest match. This preserves observations without merging distinct
vehicles sharing seller, stock, and part. Legacy keys can coexist with v4 keys;
new inventory always uses v4.

Historical evidence and incidents are in
[history/reconciliation-history.md](history/reconciliation-history.md).
