import { assertEquals } from "jsr:@std/assert@1.0.19";
import { parseSearchOptions } from "../src/parsers/search_options.ts";
import { parseRefinementChoices } from "../src/parsers/refinement.ts";
import { hasNextResultsPage, parseResults } from "../src/parsers/results.ts";
import { currentResultsFixture } from "./fixtures/car_part_current_results.ts";

Deno.test("parses current option labels separately from values", () => {
  const result = parseSearchOptions(
    `<select name="userDate"><option>Select Year</option><option value="2015">2015</option></select><select name="userModel"><option value="honda-accord">Honda Accord</option></select><select name="userPart"><option value="601.1">Alternator</option></select><select name="userLocation"><option value="NY">New York</option></select><select name="userPreference"><option value="price">Price</option></select>`,
  );
  assertEquals(result.makeModels, [{
    label: "Honda Accord",
    value: "honda-accord",
  }]);
  assertEquals(result.parts, [{ label: "Alternator", value: "601.1" }]);
});

Deno.test("parses refinement labels without exposing opaque radio values", () => {
  assertEquals(
    parseRefinementChoices(
      `<form id="MainForm"><input id="a" type="radio" name="dummyVar" value="opaque"><label for="a">2.4L, AT</label></form>`,
    ),
    ["2.4L, AT"],
  );
});

Deno.test("parses a sanitized result row and next-page link", () => {
  const html =
    `<table><tr><td>Year</td><td>Part</td><td>Stock#</td></tr><tr><td>2015<br>Alternator<br>Honda Accord</td><td><a href="https://image.test/?partsourceid=1097&partGUID=p1&vehicleGUID=v1"><img src="https://image.test/a.jpg"></a>2.4L</td><td>A</td><td>ABC123</td><td>$107</td><td><a href="https://dealer.test">Recycler</a> USA-NY(Test) <a href="/cgi-bin/quoteForm.cgi?type=g&selleruserid=1213&tk1=secret&seqNum=session">Request_Quote</a> 555-123-4567</td></tr></table><a href="?userPage=2">2</a>`;
  const [listing] = parseResults(html);
  assertEquals(listing.stockNumber, "ABC123");
  assertEquals(listing.partGuid, "p1");
  assertEquals(listing.sellerUserId, "1213");
  assertEquals(listing.quoteUrl?.includes("secret"), false);
  assertEquals(hasNextResultsPage(html), true);
});

Deno.test("parses the current semantic Car-Part result layout", () => {
  const [priced, call] = parseResults(currentResultsFixture);
  assertEquals(priced.stockNumber, "799239");
  assertEquals(priced.damageCode, "6S55D4");
  assertEquals(priced.grade, "C9cc");
  assertEquals(priced.price, { display: "$380", amount: 380, currency: "USD" });
  assertEquals(priced.recycler, { name: "Example Recycler", location: "USA-NH(Concord)", phone: "800-555-1212" });
  assertEquals(priced.imageUrl, "https://wsimgoh.car-part.com/1004/a_thumb.jpg");
  assertEquals(priced.photoUrl?.includes("partGUID=part-1"), true);
  assertEquals(priced.quoteUrl?.includes("secret"), false);
  assertEquals(priced.quoteUrl?.includes("sessionID"), false);
  assertEquals(call.stockNumber, "FKC062");
  assertEquals(call.price, { display: "Call", amount: undefined, currency: undefined });
  assertEquals(call.imageUrl, undefined);
  assertEquals(call.photoUrl, undefined);
});
