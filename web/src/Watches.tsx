import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  type Catalog,
  catalog,
  dashboard,
  deleteWatch,
  refreshUnreadCount,
  resolveWatch,
  runWatch,
  saveWatch,
  type SelectOption,
  type Watch,
  watch,
  type WatchDraft,
  watches,
} from "./api.ts";

const frequencies: Record<number, string> = {
  0: "Not scheduled",
  1: "Once daily",
  2: "Twice daily",
  3: "Three times daily",
};

const emptyDraft: WatchDraft = {
  name: "",
  enabled: true,
  year: "",
  makeModel: "",
  part: "",
  location: "",
  sort: "",
  postalCode: "",
  scheduleEnabled: false,
  runFrequency: 1,
  notifyOnInitialRun: false,
};

const optionValue = (option: SelectOption) => option.value || option.label;
const inputValue = (options: SelectOption[], value: string) =>
  options.find((option) => option.value === value)?.label ?? value;

function SearchSelect({
  id,
  label,
  value,
  options,
  onChange,
  required = false,
}: {
  id: string;
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const listId = `${id}-options`;
  const visible = useMemo(() => {
    const needle = value.toLowerCase();
    return options.filter((option) =>
      option.label.toLowerCase().includes(needle)
    )
      .slice(0, 80);
  }, [options, value]);

  return (
    <label htmlFor={id}>
      {label}
      <input
        id={id}
        list={listId}
        value={inputValue(options, value)}
        onChange={(event) => {
          const typed = event.target.value;
          const matched = options.find((option) =>
            option.label === typed || option.value === typed
          );
          onChange(matched ? optionValue(matched) : typed);
        }}
        required={required}
        autoComplete="off"
      />
      <datalist id={listId}>
        {visible.map((option) => (
          <option key={option.value} value={option.label} />
        ))}
      </datalist>
    </label>
  );
}

function payload(draft: WatchDraft): WatchDraft {
  return {
    ...draft,
    location: draft.location || undefined,
    postalCode: draft.postalCode || undefined,
    scheduleEnabled: draft.runFrequency > 0,
    runFrequency: draft.runFrequency || 1,
  };
}

function fromWatch(value: Watch): WatchDraft {
  return { ...value, refinementLabel: value.refinement?.label };
}

export function WatchList() {
  const [items, setItems] = useState<Watch[]>();
  const [lastRuns, setLastRuns] = useState<Record<string, string>>({});
  const [running, setRunning] = useState<string>();
  const [message, setMessage] = useState<string>();

  const load = async () => {
    try {
      const [loaded, board] = await Promise.all([watches(), dashboard()]);
      setItems(loaded);
      setLastRuns(Object.fromEntries(
        board.watches.flatMap((item) =>
          item.lastRun?.startedAt ? [[item.id, item.lastRun.startedAt]] : []
        ),
      ));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load saved searches",
      );
    }
  };

  useEffect(() => {
    load();
  }, []);

  const update = async (item: Watch, changes: Partial<WatchDraft>) => {
    try {
      await saveWatch({ ...fromWatch(item), ...changes }, item.id);
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not save saved search",
      );
    }
  };

  const remove = async (item: Watch) => {
    if (!confirm(`Delete “${item.name}”? This cannot be undone.`)) return;
    try {
      await deleteWatch(item.id);
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not delete saved search",
      );
    }
  };

  const execute = async (item: Watch) => {
    setRunning(item.id);
    setMessage(`Running ${item.name}…`);
    try {
      const result = await runWatch(item.id);
      setMessage(
        `${item.name}: ${result.listingCount ?? 0} results · ${
          result.newListingCount ?? 0
        } new · ${result.changedCount ?? 0} changed`,
      );
      await load();
      refreshUnreadCount();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Run failed");
    } finally {
      setRunning(undefined);
    }
  };

  return (
    <main>
      <header>
        <div className="headerTitleGroup">
          <p className="eyebrow">SAVED SEARCHES</p>
          <h1>Saved Searches</h1>
        </div>
        <div className="headerActions">
          <Link className="buttonLink" to="/watches/new">
            New saved search
          </Link>
        </div>
      </header>

      {message && <p className="notice">{message}</p>}

      {!items
        ? <p className="muted">Loading saved searches…</p>
        : items.length === 0
        ? (
          <section className="empty">
            <h2>No saved searches yet</h2>
            <p>Create one to begin tracking parts across recyclers.</p>
            <Link className="buttonLink" to="/watches/new">
              Create saved search
            </Link>
          </section>
        )
        : (
          <section className="watchGrid">
            {items.map((item) => (
              <article className="watch" key={item.id}>
                <div className="watchTop">
                  <div>
                    <h3>{item.name}</h3>
                    <p>
                      {[item.year, item.makeModel, item.part].filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <span className={`badge ${item.enabled ? "green" : "slate"}`}>
                    {item.enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>

                <p className="criteria">
                  {[
                    item.location || "Any location",
                    item.refinement?.label,
                  ].filter(Boolean).join(" · ")}
                </p>

                <div className="badges">
                  <span className={`badge ${item.scheduleEnabled ? "blue" : "slate"}`}>
                    {item.scheduleEnabled
                      ? frequencies[item.runFrequency]
                      : "Not scheduled"}
                  </span>
                  {item.refinement?.label && (
                    <span className="badge slate">{item.refinement.label}</span>
                  )}
                </div>

                <dl>
                  <div>
                    <dt>Location</dt>
                    <dd>{item.location || "Any"}</dd>
                  </div>
                  <div>
                    <dt>Schedule</dt>
                    <dd>
                      {item.scheduleEnabled
                        ? frequencies[item.runFrequency]
                        : "Manual"}
                    </dd>
                  </div>
                  <div>
                    <dt>Last run</dt>
                    <dd>
                      {lastRuns[item.id]
                        ? new Intl.DateTimeFormat(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        }).format(new Date(lastRuns[item.id]))
                        : "Not run yet"}
                    </dd>
                  </div>
                </dl>

                <div className="actions cardActions">
                  <Link className="buttonLink quiet" to={`/watches/${item.id}`}>
                    Open
                  </Link>
                  <Link
                    className="buttonLink quiet"
                    to={`/watches/${item.id}/edit`}
                  >
                    Edit
                  </Link>
                  <button
                    disabled={running === item.id}
                    onClick={() => execute(item)}
                  >
                    {running === item.id ? "Running…" : "Run"}
                  </button>
                  <button
                    className="quiet"
                    onClick={() => update(item, { enabled: !item.enabled })}
                  >
                    {item.enabled ? "Disable" : "Enable"}
                  </button>
                  <button
                    className="danger"
                    onClick={() => remove(item)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}
    </main>
  );
}

export function WatchForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [options, setOptions] = useState<Catalog>();
  const [draft, setDraft] = useState<WatchDraft>(emptyDraft);
  const [loading, setLoading] = useState(Boolean(id));
  const [refinements, setRefinements] = useState<
    Array<{ label: string }> | undefined
  >(
    id ? [] : undefined,
  );
  const [error, setError] = useState<string>();

  useEffect(() => {
    Promise.all([catalog(), id ? watch(id) : Promise.resolve(undefined)]).then(
      ([loaded, existing]) => {
        setOptions(loaded);
        if (existing) setDraft(fromWatch(existing));
      },
    ).catch((cause) =>
      setError(cause instanceof Error ? cause.message : "Could not load form")
    )
      .finally(() => setLoading(false));
  }, [id]);

  const set = (key: keyof WatchDraft, value: string | boolean | number) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const changedCriteria = (key: keyof WatchDraft, value: string) => {
    setDraft((current) => ({
      ...current,
      [key]: value,
      refinementLabel: undefined,
    }));
    setRefinements(undefined);
  };

  const validate = () => {
    if (
      !draft.name.trim() || !draft.year || !draft.makeModel || !draft.part ||
      !draft.sort
    ) return "Complete all required search fields.";
    if (draft.sort === "zip" && !draft.postalCode?.trim()) {
      return "Postal code is required when sorting by distance.";
    }
    return undefined;
  };

  const continueToRefinement = async () => {
    const validation = validate();
    if (validation) return setError(validation);
    setError(undefined);
    try {
      const result = await resolveWatch(payload(draft));
      if (result.status === "ready") setRefinements([]);
      else setRefinements(result.choices ?? []);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not resolve refinements",
      );
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validation = validate();
    if (validation) return setError(validation);
    if (refinements === undefined) return continueToRefinement();
    if (refinements?.length && !draft.refinementLabel) {
      return setError("Choose a refinement to continue.");
    }
    try {
      const saved = await saveWatch(payload(draft), id);
      navigate(`/watches/${saved.id}`);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save saved search",
      );
    }
  };

  if (loading || !options) {
    return (
      <main className="formPage">
        <p className="muted">Loading saved search…</p>
      </main>
    );
  }

  return (
    <main className="formPage">
      <Link className="backLink" to={id ? `/watches/${id}` : "/watches"}>
        ← {id ? "Back to Saved Search" : "Back to Saved Searches"}
      </Link>
      <header>
        <div>
          <p className="eyebrow">{id ? "EDIT" : "NEW"} SAVED SEARCH</p>
          <h1>{id ? "Edit Saved Search" : "New Saved Search"}</h1>
        </div>
      </header>

      <form className="panel form" onSubmit={submit}>
        {error && <p className="notice error">{error}</p>}

        <div className="formSectionTitle">Search Criteria</div>

        <label>
          Watch Name
          <input
            value={draft.name}
            onChange={(event) => set("name", event.target.value)}
            placeholder="e.g. 2008 Honda Civic Alternator"
            required
          />
        </label>

        <div className="twoCol" style={{ marginTop: 0 }}>
          <SearchSelect
            id="year"
            label="Year"
            value={draft.year}
            options={options.years}
            onChange={(value) => changedCriteria("year", value)}
            required
          />
          <SearchSelect
            id="make-model"
            label="Make / Model"
            value={draft.makeModel}
            options={options.makeModels}
            onChange={(value) => changedCriteria("makeModel", value)}
            required
          />
          <SearchSelect
            id="part"
            label="Part"
            value={draft.part}
            options={options.parts}
            onChange={(value) => changedCriteria("part", value)}
            required
          />
          <SearchSelect
            id="location"
            label="Location"
            value={draft.location ?? ""}
            options={options.locations}
            onChange={(value) => changedCriteria("location", value)}
          />
        </div>

        <div className="twoCol" style={{ marginTop: 0 }}>
          <label>
            Sort
            <select
              value={draft.sort}
              onChange={(event) => changedCriteria("sort", event.target.value)}
              required
            >
              <option value="">Select sort order</option>
              {options.sorts.map((option) => (
                <option key={option.value} value={optionValue(option)}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {draft.sort === "zip" && (
            <label>
              Postal Code
              <input
                value={draft.postalCode ?? ""}
                onChange={(event) =>
                  changedCriteria("postalCode", event.target.value)}
                placeholder="ZIP / Postal code"
                required
              />
            </label>
          )}
        </div>

        <div className="formSectionTitle">Schedule &amp; Automation</div>

        <label>
          Schedule Frequency
          <select
            value={draft.scheduleEnabled ? draft.runFrequency : 0}
            onChange={(event) => {
              const value = Number(event.target.value);
              setDraft((current) => ({
                ...current,
                scheduleEnabled: value > 0,
                runFrequency: (value || 1) as 1 | 2 | 3,
              }));
            }}
          >
            {Object.entries(frequencies).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        <label className="check">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(event) => set("enabled", event.target.checked)}
          />
          Enabled (active in background searches)
        </label>

        <label className="check">
          <input
            type="checkbox"
            checked={draft.notifyOnInitialRun}
            onChange={(event) =>
              set("notifyOnInitialRun", event.target.checked)}
          />
          Notify on the initial successful run
        </label>

        {refinements && refinements.length > 0 && (
          <fieldset>
            <legend>Refinement Required</legend>
            <p className="muted" style={{ margin: "0 0 8px" }}>
              Car-Part requires specifying this part sub-category:
            </p>
            {refinements.map((item) => (
              <label className="check" key={item.label}>
                <input
                  type="radio"
                  name="refinement"
                  checked={draft.refinementLabel === item.label}
                  onChange={() =>
                    set("refinementLabel", item.label)}
                />
                {item.label}
              </label>
            ))}
          </fieldset>
        )}

        <div className="actions" style={{ marginTop: 12 }}>
          {refinements === undefined
            ? (
              <button type="button" onClick={continueToRefinement}>
                Continue
              </button>
            )
            : <button type="submit">Save saved search</button>}
          <Link className="buttonLink quiet" to={id ? `/watches/${id}` : "/watches"}>
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
