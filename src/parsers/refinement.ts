import { parseHTML } from "npm:linkedom@0.18.12";

export function parseRefinementChoices(html: string): string[] {
  const document = (parseHTML(html) as unknown as { document: any }).document;
  return [
    ...document.querySelectorAll(
      "#MainForm input[type='radio'][name='dummyVar']",
    ),
  ]
    .map((input: any) =>
      [...document.querySelectorAll("#MainForm label")].find((label: any) =>
        label.getAttribute("for") === input.id
      )?.textContent?.trim() ?? ""
    )
    .filter(Boolean);
}
