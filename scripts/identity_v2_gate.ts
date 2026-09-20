import { BrowserlessBrowserProvider } from "../src/browser/browserless_browser_provider.ts";
import { runCarPartSearch } from "../src/browser/car_part_browser.ts";
import { identityForListing, sourceKey } from "../src/identity.ts";
import type { CarPartSearchRequest } from "../src/types.ts";

const args = Deno.args.filter((x) => x !== "--"); const path = args[args.indexOf("--criteria") + 1];
if (!path) throw new Error("Usage: deno task identity-v2-gate -- --criteria /tmp/criteria.json");
const input = JSON.parse(await Deno.readTextFile(path));
const criteria: CarPartSearchRequest = { year: input.year, makeModel: input.makeModel, part: input.part, location: input.location, sort: input.sort, postalCode: input.postalCode, refinement: input.refinementLabel ? { label: input.refinementLabel } : undefined };
for (const field of ["year", "makeModel", "part", "sort"] as const) if (!criteria[field]) throw new Error(`Missing ${field}`);
if (criteria.sort === "zip" && !criteria.postalCode) throw new Error("Missing postalCode");
async function snapshot(name: string) {
  const result = await runCarPartSearch(new BrowserlessBrowserProvider(), criteria);
  const rows = await Promise.all(result.results.listings.map(async (x) => ({ sellerUserId:x.sellerUserId,stockNumber:x.stockNumber,partGuid:x.partGuid,vehicleGuid:x.vehicleGuid,partSourceId:x.partSourceId,year:x.year,makeModel:x.makeModel,part:x.part,recyclerName:x.recycler?.name,key:await sourceKey(x),method:identityForListing(x)?.method })));
  const identified=rows.filter((x)=>x.key); const groups=new Map<string,typeof rows>(); for(const x of identified) groups.set(x.key!, [...(groups.get(x.key!)??[]),x]);
  const sig=(x:any)=>JSON.stringify([x.sellerUserId,x.stockNumber,x.year,x.makeModel,x.part]);
  const collisions=[...groups.values()].filter((g)=>new Set(g.map(sig)).size>1).length;
  const out={pages:result.results.pagesFetched,raw:rows.length,parsed:rows.length,identified:identified.length,skipped:rows.length-identified.length,unique:groups.size,collisions,rows};
  await Deno.writeTextFile(`/tmp/crv-identity-v2-snapshot-${name}.json`,JSON.stringify(out)); return out;
}
const a=await snapshot("a"); const b=await snapshot("b");
const inventoryKey=(x:any)=>`${x.sellerUserId}|${x.stockNumber}|${x.part}`;
const ka=new Map(a.rows.filter(x=>x.key).map(x=>[inventoryKey(x),x.key])); const kb=new Map(b.rows.filter(x=>x.key).map(x=>[inventoryKey(x),x.key]));
const both=[...ka.keys()].filter(k=>kb.has(k)); const changed=both.filter(k=>ka.get(k)!==kb.get(k)!);
const report={a:{...a,rows:undefined},b:{...b,rows:undefined},cross:{confident:both.length,stable:both.length-changed.length,changed:changed.length,onlyA:a.identified-both.length,onlyB:b.identified-both.length},pass:a.collisions===0&&b.collisions===0&&changed.length===0};
await Deno.writeTextFile("/tmp/crv-identity-v2-report.json",JSON.stringify(report,null,2)); await Deno.writeTextFile("/tmp/crv-identity-v2-report.txt",JSON.stringify(report,null,2)); console.log(JSON.stringify(report,null,2));
