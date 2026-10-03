import "./web_test_setup.ts";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { assertEquals } from "jsr:@std/assert@1.0.19";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { DashboardPage } from "../web/src/App.tsx";
import { Inbox } from "../web/src/Inbox.tsx";
import { GlobalRunHistory } from "../web/src/RunHistory.tsx";
import { Listings } from "../web/src/WatchDetail.tsx";
import { WatchForm } from "../web/src/Watches.tsx";
import {
  failureMessage,
  WatchHealthBadge,
} from "../web/src/components/WatchHealthBadge.tsx";
import { WatchSummary } from "../web/src/components/watch-detail/WatchSummary.tsx";

const catalog = {
  source: "car-part",
  fetchedAt: "2026-10-02T00:00:00Z",
  years: [{ label: "2015", value: "2015" }],
  makeModels: [{ label: "Honda Accord", value: "accord" }],
  parts: [{ label: "Alternator", value: "alternator" }],
  locations: [],
  sorts: [{ label: "Price", value: "price" }],
};
const reply = (body: unknown, status = 200) =>
  Promise.resolve(Response.json(body, { status }));
function mockFetch(
  handler: (path: string, init?: RequestInit) => Promise<Response>,
) {
  const original = globalThis.fetch;
  globalThis.fetch =
    ((input: string | URL | Request, init?: RequestInit) =>
      handler(
        typeof input === "string" ? input : input.toString(),
        init,
      )) as typeof fetch;
  return () => {
    globalThis.fetch = original;
    cleanup();
  };
}

Deno.test("watch refinement flow saves the selected refinement", async () => {
  const requests: Array<{ path: string; init?: RequestInit }> = [];
  const restore = mockFetch((path, init) => {
    requests.push({ path, init });
    if (path === "/api/catalog") return reply(catalog);
    if (path === "/api/watches/resolve") {
      return reply({
        status: "refinement_required",
        choices: [{ label: "2.4L automatic" }],
      });
    }
    if (path === "/api/watches") {
      return reply({ id: "watch-1", ...JSON.parse(String(init?.body)) });
    }
    throw new Error(`Unexpected request: ${path}`);
  });
  try {
    render(
      <MemoryRouter initialEntries={["/watches/new"]}>
        <Routes>
          <Route path="/watches/new" element={<WatchForm />} />
          <Route path="/watches/:id" element={<div />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByRole("button", { name: "Continue" });
    for (
      const [label, value] of [
        ["Watch Name", "Accord alternator"],
        ["Year", "2015"],
        ["Make / Model", "Honda Accord"],
        ["Part", "Alternator"],
        ["Sort", "price"],
      ]
    ) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByText("Refinement Required");
    fireEvent.click(screen.getByLabelText("2.4L automatic"));
    fireEvent.click(screen.getByRole("button", { name: "Save saved search" }));
    await waitFor(() => assertEquals(requests.at(-1)?.path, "/api/watches"));
    assertEquals(
      JSON.parse(String(requests.at(-1)?.init?.body)).refinementLabel,
      "2.4L automatic",
    );
  } finally {
    restore();
  }
});

Deno.test("manual run presents success and failure feedback", async () => {
  let fail = false;
  let runCalls = 0;
  const restore = mockFetch((path, init) => {
    if (path === "/api/dashboard") {
      return reply({
        timezone: "UTC",
        summary: {},
        watches: [{
          id: "watch-1",
          name: "Starter Search",
          enabled: true,
          criteria: {},
          schedule: {},
        }],
        recentRuns: [],
      });
    }
    if (path === "/api/watches/watch-1/run" && init?.method === "POST") {
      runCalls++;
      return fail ? reply({ error: "Browser unavailable" }, 502) : reply({
        runId: "run-1",
        status: "succeeded",
        listingCount: 3,
        newListingCount: 1,
        changedCount: 0,
        pagesFetched: 1,
        durationMs: 20,
        newListings: [],
      });
    }
    throw new Error(`Unexpected request: ${path}`);
  });
  try {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );
    await screen.findByText("Starter Search");
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    await screen.findByText("3 results · 1 new · 0 changed");
    await waitFor(() => assertEquals(runCalls, 1));
    fail = true;
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    await screen.findByText("Browser unavailable");
    await waitFor(() => assertEquals(runCalls, 2));
  } finally {
    restore();
  }
});

Deno.test("watch health appears on the dashboard and detail with safe failure fallback", async () => {
  const health = {
    status: "failing" as const,
    consecutiveScheduledFailures: 2,
    lastFailureAt: "2026-10-02T00:00:00Z",
    lastFailureCode: "UNKNOWN_SAFE_CODE",
    lastFailureMessage: "Source returned an unexpected response",
  };
  const restore = mockFetch((path) => {
    if (path === "/api/dashboard") {
      return reply({
        timezone: "UTC",
        summary: { failingWatchCount: 1 },
        failingWatches: [{ id: "watch-1", name: "Failing Search", health }],
        watches: [],
        recentRuns: [],
      });
    }
    throw new Error(`Unexpected request: ${path}`);
  });
  try {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );
    await screen.findByText("Needs attention");
    screen.getByText("Failing Search");
    screen.getByText(/Source returned an unexpected response/);
    cleanup();
    render(
      <MemoryRouter>
        <WatchSummary
          item={{
            id: "watch-1",
            name: "Failing Search",
            enabled: true,
            year: "2015",
            makeModel: "Honda Accord",
            part: "Alternator",
            sort: "price",
            scheduleEnabled: true,
            runFrequency: 1,
            notifyOnInitialRun: false,
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z",
            health,
          }}
          timezone="UTC"
          running={false}
          onRun={() => {}}
          onToggle={() => {}}
          onDelete={() => {}}
        />
      </MemoryRouter>,
    );
    screen.getByText("Operational Status");
    screen.getByText("Failed 2 scheduled runs");
    assertEquals(
      failureMessage(health),
      "Source returned an unexpected response",
    );
    cleanup();
    render(
      <WatchHealthBadge
        health={{ status: "healthy", consecutiveScheduledFailures: 0 }}
      />,
    );
    screen.getByText("Healthy");
    cleanup();
    render(
      <WatchHealthBadge
        health={{ status: "never_run", consecutiveScheduledFailures: 0 }}
      />,
    );
    screen.getByText("Never run");
  } finally {
    restore();
  }
});

Deno.test("notification filters and mark-read actions refresh the inbox", async () => {
  const paths: string[] = [];
  const event = {
    id: "event-1",
    watchId: "watch-1",
    searchRunId: "run-1",
    eventType: "listing_updated",
    createdAt: "2026-10-02T00:00:00Z",
    payload: {
      version: 1,
      eventId: "event-1",
      eventType: "listing_updated",
      watch: { id: "watch-1", name: "Accord" },
      listing: { id: "listing-1", title: "2015 Accord Alternator" },
      changes: [{ field: "price_display", oldValue: "$100", newValue: "$120" }],
      schedule: { slot: "manual" },
    },
  };
  const restore = mockFetch((path) => {
    paths.push(path);
    if (path.startsWith("/api/notifications")) {
      return path.endsWith("/read") ? reply({ ok: true }) : reply({
        items: paths.some((item) => item.endsWith("/read")) ? [] : [event],
        unreadCount: 1,
      });
    }
    if (path === "/api/watches") return reply([]);
    if (path === "/api/system") return reply({ timezone: "UTC" });
    throw new Error(`Unexpected request: ${path}`);
  });
  try {
    render(
      <MemoryRouter initialEntries={["/new-parts"]}>
        <Routes>
          <Route path="/new-parts" element={<Inbox />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByText("2015 Accord Alternator");
    fireEvent.change(screen.getByLabelText("Type"), {
      target: { value: "listing_updated" },
    });
    await waitFor(() =>
      assertEquals(
        paths.some((path) => path.includes("type=listing_updated")),
        true,
      )
    );
    fireEvent.click(screen.getByRole("button", { name: "Mark read" }));
    await waitFor(() =>
      assertEquals(paths.some((path) => path.endsWith("/read")), true)
    );
  } finally {
    restore();
  }
});

Deno.test("run history filters and listing diffs are rendered", async () => {
  const restore = mockFetch((path) => {
    if (path === "/api/runs") {
      return reply([{
        id: "run-1",
        watchId: "watch-1",
        watchName: "Success Watch",
        status: "succeeded",
        startedAt: "2026-10-02T00:00:00Z",
      }, {
        id: "run-2",
        watchId: "watch-2",
        watchName: "Failed Watch",
        status: "failed",
        startedAt: "2026-10-02T00:00:00Z",
      }]);
    }
    if (path === "/api/watches") return reply([]);
    if (path === "/api/system") return reply({ timezone: "UTC" });
    throw new Error(`Unexpected request: ${path}`);
  });
  try {
    render(
      <MemoryRouter initialEntries={["/runs"]}>
        <Routes>
          <Route path="/runs" element={<GlobalRunHistory />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByRole("link", { name: "Success Watch" });
    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "failed" },
    });
    await screen.findByRole("link", { name: "Failed Watch" });
    assertEquals(screen.queryByRole("link", { name: "Success Watch" }), null);
    cleanup();
    render(
      <Listings
        items={[{
          id: "listing-1",
          year: "2015",
          makeModel: "Honda Accord",
          part: "Alternator",
          priceDisplay: "$120",
          firstSeenAt: "2026-10-01T00:00:00Z",
          lastSeenAt: "2026-10-02T00:00:00Z",
          isModified: true,
          changes: [{
            field: "price_display",
            oldValue: "$100",
            newValue: "$120",
          }, { field: "grade", oldValue: "A", newValue: "B" }],
        }]}
        loading={false}
        failed={false}
        timezone="UTC"
        limit={50}
        onLimitChange={() => {}}
        onRun={() => {}}
        retry={() => {}}
      />,
    );
    screen.getByText("MODIFIED");
    screen.getByText("$100");
    screen.getByText("Grade: A → B");
  } finally {
    restore();
  }
});
