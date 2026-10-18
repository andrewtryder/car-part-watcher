import { assertEquals } from "jsr:@std/assert@1.0.19";
import { parseListingColor } from "../src/color_parser.ts";

Deno.test("parses black abbreviations and names", () => {
  assertEquals(
    parseListingColor("000 PAINT CODE NH731P BLACK NH731P BLK")?.color,
    "Black",
  );
  assertEquals(
    parseListingColor("NOTE 4DR SUV BLK PROD DATE: 2018-01-01")?.color,
    "Black",
  );
  assertEquals(
    parseListingColor("(PC=BK) 000 7/1/18 LESS REBAR")?.color,
    "Black",
  );
  assertEquals(
    parseListingColor("BLACK-NH731P,ASSEMBLY,NORMAL WEAR")?.color,
    "Black",
  );
  assertEquals(parseListingColor("fog lamps, Black color")?.color, "Black");
  assertEquals(parseListingColor("upper only black")?.color, "Black");
});

Deno.test("parses white abbreviations and names", () => {
  assertEquals(parseListingColor("000,WHT")?.color, "White");
  assertEquals(
    parseListingColor("000 PAINT CODE NH603P WHITE NH603P WHT")?.color,
    "White",
  );
  assertEquals(
    parseListingColor("White Diamond Pearl REBAR XTRA")?.color,
    "White",
  );
  assertEquals(
    parseListingColor("NICE WHITE UP BLACK LOW SM CRACK")?.color,
    "White",
  );
});

Deno.test("parses silver abbreviations and names", () => {
  assertEquals(
    parseListingColor("000 PAINT CODE NH830MX SILVER NH830MX SLV")?.color,
    "Silver",
  );
  assertEquals(
    parseListingColor("FRONT SLV BUMPER W/FOG TEXTURED")?.color,
    "Silver",
  );
  assertEquals(
    parseListingColor("fog lamps,LUNAR SILVER(SI)")?.color,
    "Silver",
  );
  assertEquals(
    parseListingColor("EX-L,SILV NH830M,MINOR SCUFFS")?.color,
    "Silver",
  );
  assertEquals(parseListingColor("cover only syvler")?.color, "Silver");
  assertEquals(
    parseListingColor("001,SLV-NH830M,INCLUDES FOG LIGHTS*")?.color,
    "Silver",
  );
});

Deno.test("parses gray abbreviations and specialty names", () => {
  assertEquals(parseListingColor("000 GRY 4DR")?.color, "Gray");
  assertEquals(
    parseListingColor("000 GUN METAL METALLIC PRE-CRUSH SALE!")?.color,
    "Gray",
  );
  assertEquals(parseListingColor("MODERN STEEL,EX-L")?.color, "Gray");
  assertEquals(parseListingColor("'T' W/FOGS CHAR")?.color, "Gray");
  assertEquals(parseListingColor("000 GRAY PCNH797MX W FOGS")?.color, "Gray");
});

Deno.test("parses blue and red abbreviations and paint codes", () => {
  assertEquals(parseListingColor("000 CLEAN PAINT CODE-B588P")?.color, "Blue");
  assertEquals(
    parseListingColor("4C1 BLU SUV EX-L WITH LIGHTS")?.color,
    "Blue",
  );
  assertEquals(
    parseListingColor("4G1 OBSIDIAN BLUE (B588P) W/FOG LAMPS")?.color,
    "Blue",
  );
  assertEquals(parseListingColor("0S1 RED SUV EX")?.color, "Red");
  assertEquals(parseListingColor("5S1,9S1,RED-R539PX,EX-L")?.color, "Red");
  assertEquals(
    parseListingColor("NEW 'RUBY RED METALLIC' UPPER BUMPER")?.color,
    "Red",
  );
});

Deno.test("parses maroon, purple, and green abbreviations", () => {
  assertEquals(
    parseListingColor("4DR SUV MRN PROD DATE: 2018-01-01")?.color,
    "Maroon",
  );
  assertEquals(
    parseListingColor("0S1,MAROON,W FOGS,PAINT CODE R548PX")?.color,
    "Maroon",
  );
  assertEquals(
    parseListingColor("BURGUNDY,GRILL EXTRA $100.00")?.color,
    "Maroon",
  );
  assertEquals(
    parseListingColor("5G1.5 PLE W/FOGS W/LWR GRILLES")?.color,
    "Purple",
  );
  assertEquals(parseListingColor("Olive-G546M With Fogs")?.color, "Green");
  assertEquals(parseListingColor("5S1,BLK,PCGN")?.color, "Green");
});

Deno.test("correctly prioritizes body color over black textured trim", () => {
  assertEquals(
    parseListingColor("4S1,INC LWR GRIL,RH FOG,BLK TXT,GRY")?.color,
    "Gray",
  );
  assertEquals(parseListingColor("RED,COMP ASSY,W/BLK LWR TEX")?.color, "Red");
  assertEquals(parseListingColor("NICE BLUE UP BLACK LOW")?.color, "Blue");
  assertEquals(parseListingColor("NICE WHITE UP BLACK LOW")?.color, "White");
  assertEquals(parseListingColor("NICE SILVER UP BLACK LOW")?.color, "Silver");
});

Deno.test("returns undefined for descriptions with no color", () => {
  assertEquals(parseListingColor("fog lamps"), undefined);
  assertEquals(parseListingColor("***REBAR ONLY***"), undefined);
  assertEquals(parseListingColor("NEW OEM LOWER VALANCE ONLY"), undefined);
  assertEquals(parseListingColor(undefined), undefined);
  assertEquals(parseListingColor(""), undefined);
});
