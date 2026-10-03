import { parseHTML } from "npm:linkedom@0.18.12";

export function parseRefinementChoices(html: string): string[] {
  const document = parseHTML(html).document as unknown as Document;
  return [
    ...document.querySelectorAll(
      "#MainForm input[type='radio'][name='dummyVar']",
    ),
  ]
    .map((input: Element) =>
      [...document.querySelectorAll("#MainForm label")].find((label: Element) =>
        label.getAttribute("for") ===
          (input.getAttribute("id") ?? (input as unknown as { id: string }).id)
      )?.textContent?.trim() ?? ""
    )
    .filter(Boolean);
}
