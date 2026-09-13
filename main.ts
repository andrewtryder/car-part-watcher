import { getCatalog, refreshCatalog } from "./src/services/catalog_service.ts";
import {
  deleteWatch,
  getWatch,
  listWatches,
  resolveWatch,
  saveWatch,
  validateWatch,
} from "./src/services/watch_service.ts";
import type { CarPartSearchRequest } from "./src/types.ts";

const json = (body: unknown, status = 200) => Response.json(body, { status });
function request(value: any): CarPartSearchRequest {
  return {
    year: value.year,
    makeModel: value.makeModel,
    part: value.part,
    location: value.location || undefined,
    sort: value.sort,
    postalCode: value.postalCode || undefined,
    refinement: value.refinementLabel
      ? { label: value.refinementLabel }
      : undefined,
  };
}
function page() {
  return new Response(
    `<!doctype html><meta charset=utf-8><title>Car Part Watcher</title><style>body{font:16px system-ui;max-width:960px;margin:2rem auto}input,select,button{padding:.45rem;margin:.2rem}select{max-width:340px}fieldset{margin:1rem 0}#choices label{display:block}</style><h1>Car Part Watcher</h1><p id=status>Loading cached catalog…</p><button id=refresh>Refresh Car-Part Catalog</button><button id=new>New Watch</button><section id=form hidden><h2 id=title>New Watch</h2><input id=name placeholder="Watch name"><fieldset><select id=year></select><input id=model list=models placeholder="Make / Model"><datalist id=models></datalist><input id=part list=parts placeholder="Part"><datalist id=parts></datalist><select id=location></select><select id=sort></select><input id=postal placeholder="Postal code"><button id=continue>Continue</button></fieldset><div id=choices></div><button id=save hidden>Save Watch</button></section><h2>Watches</h2><div id=watches></div><script>let catalog,editing,resolved;const $=id=>document.getElementById(id),opt=(el,x)=>el.innerHTML=x.map(v=>'<option value="'+v.label.replaceAll('"','&quot;')+'">'+v.label+'</option>').join('');async function api(url,o){let r=await fetch(url,o);let b=await r.json();if(!r.ok)throw Error(b.error||'Request failed');return b}function data(){return {year:$('year').value,makeModel:$('model').value,part:$('part').value,location:$('location').value||null,sort:$('sort').value,postalCode:$('postal').value||null,refinementLabel:resolved?.label||null}}async function load(){let c=await api('/api/catalog');catalog=c; $('status').textContent='Last refreshed: '+new Date(c.fetchedAt).toLocaleString()+' · '+c.years.length+' years · '+c.makeModels.length+' make/models · '+c.parts.length+' parts';opt($('year'),c.years);opt($('location'),[{label:'All Areas'}].concat(c.locations));opt($('sort'),c.sorts);opt($('models'),c.makeModels);opt($('parts'),c.parts);let ws=await api('/api/watches');$('watches').innerHTML=ws.map(w=>'<p><b>'+w.name+'</b> · '+w.year+' '+w.makeModel+' · '+w.part+' · '+(w.location||'All areas')+' · '+(w.refinement?.label||'No refinement')+' · '+(w.enabled?'Enabled':'Disabled')+' <button onclick="edit(\''+w.id+'\')">Edit</button> <button onclick="del(\''+w.id+'\')">Delete</button></p>').join('')||'<p>No watches yet.</p>'}window.edit=async id=>{let w=await api('/api/watches/'+id);editing=w;$('form').hidden=false;$('title').textContent='Edit Watch';$('name').value=w.name;$('year').value=w.year;$('model').value=w.makeModel;$('part').value=w.part;$('location').value=w.location||'All Areas';$('sort').value=w.sort;$('postal').value=w.postalCode||'';resolved=w.refinement;$('save').hidden=false};window.del=async id=>{if(confirm('Delete this watch?')){await api('/api/watches/'+id,{method:'DELETE'});load()}};$('new').onclick=()=>{editing=null;resolved=null;$('form').hidden=false;$('title').textContent='New Watch';$('save').hidden=true;$('choices').textContent=''};$('refresh').onclick=async()=>{ $('refresh').disabled=true;try{await api('/api/catalog/refresh',{method:'POST'});await load()}catch(e){alert(e.message)}finally{$('refresh').disabled=false}};$('continue').onclick=async()=>{let b=$('continue');b.disabled=true;try{let r=await api('/api/watches/resolve',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data())});resolved=r.status==='ready'?null:undefined;$('choices').innerHTML=r.status==='ready'?'No refinement required.':'<p>Select refinement:</p>'+r.choices.map(c=>'<label><input type=radio name=r value="'+c.label.replaceAll('"','&quot;')+'"> '+c.label+'</label>').join('');$('save').hidden=false}catch(e){alert(e.message)}finally{b.disabled=false}};$('choices').onchange=e=>{if(e.target.name==='r')resolved={label:e.target.value}};$('save').onclick=async()=>{try{let body={...data(),name:$('name').value,enabled:editing?.enabled??true,resolveStatus:resolved===undefined?'refinement_required':'ready'};await api(editing?'/api/watches/'+editing.id:'/api/watches',{method:editing?'PUT':'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});$('form').hidden=true;load()}catch(e){alert(e.message)}};load().catch(e=>{$('status').textContent=e.message})</script>`,
    { headers: { "content-type": "text/html;charset=utf-8" } },
  );
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  // Authentication is intentionally deferred until the console's next phase.
  try {
    if (url.pathname === "/") return page();
    if (url.pathname === "/api/catalog" && req.method === "GET") {
      const c = await getCatalog();
      return c
        ? json({ source: c.source, fetchedAt: c.fetchedAt, ...c.payload })
        : json({ error: "Catalog is not initialized" }, 404);
    }
    if (url.pathname === "/api/catalog/refresh" && req.method === "POST") {
      const c = await refreshCatalog();
      return json({
        ok: true,
        fetchedAt: c!.fetchedAt,
        counts: Object.fromEntries(
          Object.entries(c!.payload).map(([k, v]) => [k, v.length]),
        ),
      });
    }
    if (url.pathname === "/api/watches" && req.method === "GET") {
      return json(await listWatches());
    }
    if (url.pathname === "/api/watches/resolve" && req.method === "POST") {
      return json(await resolveWatch(request(await req.json())));
    }
    if (url.pathname === "/api/watches" && req.method === "POST") {
      const b = await req.json();
      const draft = {
        ...request(b),
        name: b.name ?? "",
        enabled: b.enabled !== false,
      };
      await validateWatch(draft);
      if (b.resolveStatus === "refinement_required" && !draft.refinement) {
        return json({ error: "Select a refinement before saving" }, 400);
      }
      return json(
        await saveWatch({
          ...draft,
          id: crypto.randomUUID(),
          createdAt: "",
          updatedAt: "",
        }),
        201,
      );
    }
    const id = url.pathname.match(/^\/api\/watches\/([\w-]+)$/)?.[1];
    if (id && req.method === "GET") {
      const w = await getWatch(id);
      return w ? json(w) : json({ error: "Not found" }, 404);
    }
    if (id && req.method === "PUT") {
      const b = await req.json();
      const existing = await getWatch(id);
      if (!existing) return json({ error: "Not found" }, 404);
      const draft = {
        ...request(b),
        name: b.name ?? "",
        enabled: b.enabled !== false,
      };
      await validateWatch(draft);
      if (
        (existing.year !== draft.year ||
          existing.makeModel !== draft.makeModel ||
          existing.part !== draft.part) && !draft.refinement
      ) {
        return json({
          error: "Resolve refinement after vehicle criteria change",
        }, 400);
      }
      return json(
        await saveWatch({
          ...draft,
          id,
          createdAt: existing.createdAt,
          updatedAt: existing.updatedAt,
        }),
      );
    }
    if (id && req.method === "DELETE") {
      return (await deleteWatch(id))
        ? new Response(null, { status: 204 })
        : json({ error: "Not found" }, 404);
    }
    return new Response("Not found", { status: 404 });
  } catch (error) {
    return json({
      error: error instanceof Error ? error.message : "Request failed",
    }, 400);
  }
});
