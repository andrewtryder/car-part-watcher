# Web console

Authentication is explicitly deferred by the owner for this initial personal
console; it must be added before sharing the public URL. Refreshing the catalog
is the only catalog operation that opens Browserless; normal console reads use
cached Postgres data. Creating a watch first resolves current human-visible
refinement choices, then saves only the selected label. Watches can be edited,
toggled, and deleted. There is no scheduler, listing storage, or notification
feature.

SECURITY TODO: Administrative console is currently unauthenticated.
