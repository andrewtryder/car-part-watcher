import type { CarPartListing } from "../types.ts";
import { parseHTML } from "npm:linkedom@0.18.12";

const text = (element?: Element | null) =>
  element?.textContent?.replace(/\s+/g, " ").trim() || undefined;

function urlParam(url: string | undefined, name: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url, "https://www.car-part.com").searchParams.get(name) ??
      undefined;
  } catch {
    return undefined;
  }
}

function sanitizedQuoteUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  let url: URL;
  try {
    url = new URL(value, "https://www.car-part.com");
  } catch {
    return undefined;
  }
  for (const key of [...url.searchParams.keys()]) {
    if (/^tk[1-6]$/i.test(key) || /^(seqNum|sessionID|userUID)$/i.test(key)) {
      url.searchParams.delete(key);
    }
  }
  return url.href;
}

function absoluteUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, "https://www.car-part.com");
    return /^https?:$/.test(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function parseVehicle(value?: string) {
  const lines =
    value?.split(/\s*\n\s*/).map((line) => line.trim()).filter(Boolean) ?? [];
  return {
    year: lines[0],
    part: lines[1],
    makeModel: lines.slice(2).join(" ") || undefined,
  };
}

function parsePrice(display?: string) {
  if (!display) return undefined;
  const money = display.match(/\$\s*\d[\d,]*(?:\.\d{1,2})?/)?.[0];
  const amount = money ? Number(money.replace(/[^0-9.]/g, "")) : undefined;
  return {
    display,
    amount: amount !== undefined && Number.isFinite(amount)
      ? amount
      : undefined,
    currency: display.includes("$") ? "USD" : undefined,
  };
}

type ResultColumn =
  | "vehicle"
  | "description"
  | "damageCode"
  | "grade"
  | "stockNumber"
  | "price"
  | "recycler";

function resultCells(row: Element): Element[] {
  return [...row.children].filter((child: Element) =>
    child.tagName === "TD" || child.tagName === "TH"
  );
}

function resultColumn(label: string): ResultColumn | undefined {
  const normalized = label.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const compact = normalized.replaceAll(" ", "");
  if (compact === "yearpartmodel" || compact === "vehicle") return "vehicle";
  if (compact === "description") return "description";
  if (compact === "damagecode") return "damageCode";
  if (compact === "partgrade" || compact === "grade") return "grade";
  if (compact === "stock" || compact === "stocknumber") return "stockNumber";
  if (compact === "price" || compact === "usprice") return "price";
  if (compact === "dealerinfo" || compact === "recyclerinfo") return "recycler";
  return undefined;
}

/** Prefers the source's semantic header row; retains the prior six-cell layout as a fallback. */
function resultColumns(table: Element): Map<ResultColumn, number> | undefined {
  for (const row of table.querySelectorAll("tr")) {
    const columns = new Map<ResultColumn, number>();
    let index = 0;
    for (const cell of resultCells(row as Element)) {
      const span = Math.max(
        1,
        Number(cell.getAttribute("colspan") ?? "1") || 1,
      );
      const column = resultColumn(text(cell) ?? "");
      if (column) columns.set(column, index);
      index += span;
    }
    if (
      columns.has("vehicle") && columns.has("stockNumber") &&
      columns.has("price") && columns.has("recycler")
    ) return columns;
  }
  return undefined;
}

function directPrice(cell?: Element | null): string | undefined {
  const visible = text(cell);
  if (!visible) return undefined;
  const amount = visible.match(/\$\s*\d[\d,]*(?:\.\d{1,2})?/)?.[0];
  if (amount) return amount.replace(/\s+/g, "");
  return /\b(?:call|quote|n\/?a)\b/i.test(visible) ? visible : undefined;
}

function priceQualifier(
  cell?: Element | null,
  display?: string | undefined,
): string | undefined {
  const visible = text(cell);
  if (!visible || !display) return undefined;
  const qualifier = visible.replace(display, "").trim();
  return /^[a-z][a-z\s-]{1,40}$/i.test(qualifier) ? qualifier : undefined;
}

function sourcePhoto(
  cell?: Element | null,
): { imageUrl?: string; photoUrl?: string } {
  if (!cell) return {};
  const image = [...cell.querySelectorAll("img[src]")].find((item: Element) =>
    !/btn_livechat/i.test(item.getAttribute("src") ?? "")
  );
  const imageUrl = absoluteUrl(image?.getAttribute("src") ?? undefined);
  const link = [...cell.querySelectorAll("a[href]")].find((item: Element) =>
    /partguid/i.test(item.getAttribute("href") ?? "")
  );
  return {
    imageUrl,
    photoUrl: sanitizedQuoteUrl(link?.getAttribute("href") ?? undefined),
  };
}

function recyclerFrom(cell?: Element | null) {
  if (!cell) return undefined;
  const recyclerLink = [...cell.querySelectorAll("a[href]")].find(
    (link: Element) => {
      const href = absoluteUrl(link.getAttribute("href") ?? undefined);
      return href && !/car-part\.com|^mailto:/i.test(href) && text(link);
    },
  );
  const recyclerText = text(cell);
  const name = text(recyclerLink);
  const phone = recyclerText?.match(
    /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/,
  )?.[0];
  const location = recyclerText?.replace(name ?? "", "").replace(
    /\b(?:Request_(?:Insurance_)?Quote|E-mail|Live Chat)\b.*$/i,
    "",
  ).replace(phone ?? "", "").trim();
  return name || location || phone
    ? { name, location: location || undefined, phone }
    : undefined;
}

function decodedUrlParam(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function parseResults(html: string): CarPartListing[] {
  const document = parseHTML(html).document as unknown as Document;
  const table = [...document.querySelectorAll("table")].find((candidate) =>
    candidate.textContent?.includes("Stock#")
  );
  if (!table) return [];
  const columns = resultColumns(table as Element);
  return [...table.querySelectorAll("tr")].flatMap((row) => {
    const cells = resultCells(row as Element);
    const fallback = !columns && cells.length >= 6
      ? new Map<ResultColumn, number>([
        ["vehicle", 0],
        ["description", 1],
        ["grade", 2],
        ["stockNumber", 3],
        ["price", 4],
        ["recycler", 5],
      ])
      : columns;
    if (!fallback) return [];
    const vehicleCell = cells[fallback.get("vehicle")!];
    const vehicleText = vehicleCell
      ? Array.from(vehicleCell.childNodes)
        .map((node: Node) =>
          node.nodeName === "BR" ? "\n" : (node.textContent ?? "")
        )
        .join("")
      : undefined;
    const vehicle = parseVehicle(vehicleText);
    if (cells.length < 6 || !/^\d{4}$/.test(vehicle.year ?? "")) return [];
    const descriptionCell = cells[fallback.get("description")!];
    const recyclerCell = cells[fallback.get("recycler")!];
    const photo = sourcePhoto(descriptionCell);
    const quoteLink = [
      ...(recyclerCell?.querySelectorAll("a[href*='quoteForm.cgi']") ?? []),
    ]
      .find((link: Element) =>
        (link.getAttribute("href") ?? "").includes("type=g")
      );
    const quoteHref = quoteLink?.getAttribute("href") ?? undefined;
    const identityUrl = photo.photoUrl ?? photo.imageUrl;
    const recycler = recyclerFrom(recyclerCell);
    const quoteRecyclerName = decodedUrlParam(urlParam(quoteHref, "name"));
    return [{
      ...vehicle,
      description: text(descriptionCell)?.replace(
        /\s*Estimated CO2e Savings:.*$/i,
        "",
      ),
      damageCode: fallback.has("damageCode")
        ? text(cells[fallback.get("damageCode")!])
        : undefined,
      grade: text(cells[fallback.get("grade")!]),
      stockNumber: text(cells[fallback.get("stockNumber")!]),
      price: parsePrice(directPrice(cells[fallback.get("price")!])),
      priceQualifier: priceQualifier(
        cells[fallback.get("price")!],
        directPrice(cells[fallback.get("price")!]),
      ),
      recycler: recycler?.name || !quoteRecyclerName
        ? recycler
        : { ...recycler, name: quoteRecyclerName },
      sellerUserId: urlParam(quoteHref, "selleruserid"),
      partSourceId: urlParam(identityUrl, "partsourceid"),
      partGuid: urlParam(identityUrl, "partGUID"),
      vehicleGuid: urlParam(identityUrl, "vehicleGUID"),
      ...photo,
      quoteUrl: sanitizedQuoteUrl(quoteHref),
    }];
  });
}

export function hasNextResultsPage(html: string): boolean {
  return Boolean(nextResultsPageHref(html));
}

/** Returns only the source-provided forward link; never invents a page URL. */
export function nextResultsPageHref(
  html: string,
  currentPage = 1,
): string | undefined {
  const document = parseHTML(html).document as unknown as Document;
  const links = [
    ...(document?.querySelectorAll("a[href*='userPage=']") ?? []),
  ] as Element[];
  const link =
    links.find((candidate) =>
      /^\*\d+$/.test(candidate.textContent?.trim() ?? "")
    ) ??
      links.find((candidate) =>
        Number(candidate.textContent?.trim()) > currentPage
      );
  return link?.getAttribute("href") ?? undefined;
}
