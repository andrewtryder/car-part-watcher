import type { SearchOptions, SelectOption } from "../types.ts";
import { parseHTML } from "npm:linkedom@0.18.12";

function options(document: Document, selector: string): SelectOption[] {
  return [...document.querySelectorAll(selector)]
    .flatMap((select) => [...(select as unknown as HTMLSelectElement).options])
    .map((option) => ({
      label: option.textContent?.trim() ?? "",
      value: option.value,
    }))
    .filter((option) =>
      option.label.length > 0 && !option.label.startsWith("Select ")
    );
}

export function parseSearchOptions(html: string): SearchOptions {
  const document = parseHTML(html).document as unknown as Document;
  return {
    years: options(document, "select[name='userDate']"),
    makeModels: options(document, "select[name='userModel']"),
    parts: options(document, "select[name='userPart']"),
    locations: options(document, "select[name='userLocation']"),
    sorts: options(document, "select[name='userPreference']"),
  };
}
