import {
  deleteWatch,
  getWatch,
  listRecentSearchRuns,
  listSearchRuns,
  listWatches,
  listWatchListings,
  resolveWatch,
  saveWatch,
  validateWatch,
} from "../services/watch_service.ts";
import { executeWatch } from "../services/reconciliation_service.ts";
import type { CarPartSearchClient } from "../search/car_part_search_client.ts";
import type { CarPartSearchRequest } from "../types.ts";
import type {
  RecentRunDto,
  RunDto,
  RunWatchResponseDto,
} from "../contracts/runs.ts";
import type { WatchDto, WatchListingDto } from "../contracts/watches.ts";
import { json, parseLimitParam } from "./errors.ts";

export function parseSearchRequest(
  value: Record<string, unknown>,
): CarPartSearchRequest {
  return {
    year: String(value.year ?? ""),
    makeModel: String(value.makeModel ?? ""),
    part: String(value.part ?? ""),
    location: (value.location as string) || undefined,
    sort: (value.sort as CarPartSearchRequest["sort"]) ?? "price",
    postalCode: (value.postalCode as string) || undefined,
    refinement: value.refinementLabel
      ? { label: String(value.refinementLabel) }
      : undefined,
  };
}

export function parseWatchDraft(
  body: Record<string, unknown>,
  existing?: { id: string; createdAt: string; updatedAt: string },
) {
  return {
    ...parseSearchRequest(body),
    name: (body.name as string) ?? "",
    enabled: body.enabled !== false,
    scheduleEnabled: body.scheduleEnabled === true,
    runFrequency: [1, 2, 3].includes(Number(body.runFrequency))
      ? Number(body.runFrequency) as 1 | 2 | 3
      : 1,
    notifyOnInitialRun: body.notifyOnInitialRun === true,
    id: existing?.id ?? crypto.randomUUID(),
    createdAt: existing?.createdAt ?? "",
    updatedAt: existing?.updatedAt ?? "",
  };
}

export async function handleListWatches(): Promise<Response> {
  return json<WatchDto[]>(await listWatches());
}

export async function handleListRecentRuns(url: URL): Promise<Response> {
  return json<RecentRunDto[]>(
    await listRecentSearchRuns(
      parseLimitParam(url.searchParams.get("limit"), 50, 100),
    ),
  );
}

export async function handleResolveWatch(
  req: Request,
  searchClient: CarPartSearchClient,
): Promise<Response> {
  const body = (await req.json()) as Record<string, unknown>;
  return json(await resolveWatch(searchClient, parseSearchRequest(body)));
}

export async function handleCreateWatch(req: Request): Promise<Response> {
  const body = (await req.json()) as Record<string, unknown>;
  const draft = parseWatchDraft(body);
  await validateWatch(draft);
  return json(await saveWatch(draft), 201);
}

export async function handleRunWatch(
  id: string,
  searchClient: CarPartSearchClient,
  signal?: AbortSignal,
): Promise<Response> {
  const run = await executeWatch(searchClient, id, {
    maxRunTimeMs: 120_000,
    signal,
  });
  return run
    ? json<RunWatchResponseDto>({
      ...run,
      newListings: run.newListings.map((listing) => ({
        year: listing.year,
        makeModel: listing.makeModel,
        part: listing.part,
        description: listing.description,
        grade: listing.grade,
        stockNumber: listing.stockNumber,
        priceDisplay: listing.priceDisplay,
        recyclerName: listing.recyclerName,
        recyclerLocation: listing.recyclerLocation,
      })),
    })
    : json<RunWatchResponseDto>({ skipped: true });
}

export async function handleListWatchRuns(id: string): Promise<Response> {
  return json<RunDto[]>(await listSearchRuns(id));
}

export async function handleListWatchListings(
  url: URL,
  id: string,
): Promise<Response> {
  if (!await getWatch(id)) {
    return json({ error: "Not found" }, 404);
  }
  return json<WatchListingDto[]>(
    await listWatchListings(
      id,
      parseLimitParam(url.searchParams.get("limit"), 500, 1000),
    ),
  );
}

export async function handleGetWatch(id: string): Promise<Response> {
  const watch = await getWatch(id);
  return watch ? json<WatchDto>(watch) : json({ error: "Not found" }, 404);
}

export async function handleUpdateWatch(
  req: Request,
  id: string,
): Promise<Response> {
  const existing = await getWatch(id);
  if (!existing) return json({ error: "Not found" }, 404);
  const body = (await req.json()) as Record<string, unknown>;
  const draft = parseWatchDraft(body, existing);
  await validateWatch(draft);
  const saved = await saveWatch(draft);
  if (!saved) throw new Error("Watch not found");
  return json<WatchDto>(saved);
}

export async function handleDeleteWatch(id: string): Promise<Response> {
  return (await deleteWatch(id))
    ? new Response(null, { status: 204 })
    : json({ error: "Not found" }, 404);
}
