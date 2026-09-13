# Web console

Authentication is explicitly deferred by the owner for this initial personal
console; it must be added before sharing the public URL. Refreshing the catalog
is the only catalog operation that opens Browserless; normal console reads use
cached Postgres data. Creating a watch first resolves current human-visible
refinement choices, then saves only the selected label. Watches can be edited,
toggled, and deleted. There is no scheduler or notification feature.

Manual watch execution is available from `POST /api/watches/:id/run`; recent
run history is available from `GET /api/watches/:id/runs`. These are temporary
administrative actions while console authentication remains deferred.

SECURITY TODO: Administrative console is currently unauthenticated.
