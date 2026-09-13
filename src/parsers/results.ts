import type { CarPartListing } from "../types.ts";
import { parseHTML } from "npm:linkedom@0.18.12";

const text = (element: any | undefined) =>
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
  const url = new URL(value, "https://www.car-part.com");
  for (const key of [...url.searchParams.keys()]) {
    if (/^tk[1-6]$/i.test(key) || key === "seqNum") {
      url.searchParams.delete(key);
    }
  }
  return url.href;
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
  const amount = Number(display.replace(/[^0-9.]/g, ""));
  return {
    display,
    amount: Number.isFinite(amount) ? amount : undefined,
    currency: display.includes("$") ? "USD" : undefined,
  };
}

export function parseResults(html: string): CarPartListing[] {
  const document = (parseHTML(html) as unknown as { document: any }).document;
  const table = [...document.querySelectorAll("table")].find((candidate) =>
    candidate.textContent?.includes("Stock#")
  );
  if (!table) return [];
  return [...table.querySelectorAll("tr")].flatMap((row) => {
    const cells = [...row.children].filter((child: any) =>
      child.tagName === "TD"
    ) as any[];
    const vehicle = parseVehicle(
      cells[0]?.innerHTML?.replace(/<br\s*\/?\s*>/gi, "\n").replace(
        /<[^>]*>/g,
        "",
      ),
    );
    if (cells.length < 6 || !/^\d{4}$/.test(vehicle.year ?? "")) return [];
    const imageLink = cells[1].querySelector("a[href*='partGUID']");
    const image = cells[1].querySelector("img[src]");
    const quoteLink = [...cells[5].querySelectorAll("a[href*='quoteForm.cgi']")]
      .find((link: any) => link.href.includes("type=g"));
    const recyclerLink = [...cells[5].querySelectorAll("a")].find((link: any) =>
      !link.href.includes("quoteForm.cgi") && !link.href.includes("applet.cgi")
    );
    const recyclerText = text(cells[5]);
    const phone = recyclerText?.match(
      /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/,
    )?.[0];
    const imageUrl = image?.src;
    const identityUrl = imageLink?.href ?? imageUrl;
    return [{
      ...vehicle,
      description: text(cells[1])?.replace(/\s+/g, " "),
      grade: text(cells[2]),
      stockNumber: text(cells[3]),
      price: parsePrice(text(cells[4])),
      recycler: recyclerText
        ? {
          name: text(recyclerLink),
          location:
            recyclerText.replace(recyclerLink?.textContent ?? "", "").replace(
              phone ?? "",
              "",
            ).replace(/Request_.*/s, "").trim() || undefined,
          phone,
        }
        : undefined,
      sellerUserId: urlParam(quoteLink?.href, "selleruserid"),
      partSourceId: urlParam(identityUrl, "partsourceid"),
      partGuid: urlParam(identityUrl, "partGUID"),
      vehicleGuid: urlParam(identityUrl, "vehicleGUID"),
      imageUrl,
      quoteUrl: sanitizedQuoteUrl(quoteLink?.href),
    }];
  });
}

export function hasNextResultsPage(html: string): boolean {
  return Boolean(nextResultsPageHref(html));
}

/** Returns only the source-provided forward link; never invents a page URL. */
export function nextResultsPageHref(html: string, currentPage = 1): string | undefined {
  const document = (parseHTML(html) as unknown as { document: any }).document;
  const links = [...(document?.querySelectorAll("a[href*='userPage=']") ?? [])] as any[];
  const link = links.find((candidate) => /^\*\d+$/.test(candidate.textContent?.trim() ?? "")) ??
    links.find((candidate) => Number(candidate.textContent?.trim()) > currentPage);
  return link?.getAttribute("href") ?? undefined;
}
