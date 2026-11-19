import { ensureWorld } from './EChart'
export type Geo = { name:Record<string,string>; center:Record<string,[number,number]> }
let p:Promise<Geo>|null=null
export function loadGeo(){ if(!p) p=ensureWorld().then((g:any)=>{ const name:Record<string,string>={}, center:Record<string,[number,number]>={}
  for(const f of g.features){ name[f.id]=f.properties.name; const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates
    let best:number[][]=[],bs=-1; for(const pl of polys){ const r=pl[0]; const xs=r.map((q:number[])=>q[0]), ys=r.map((q:number[])=>q[1]); const a=(Math.max(...xs)-Math.min(...xs))*(Math.max(...ys)-Math.min(...ys)); if(a>bs){bs=a;best=r} }
    const xs=best.map(q=>q[0]), ys=best.map(q=>q[1]); center[f.id]=[(Math.max(...xs)+Math.min(...xs))/2,(Math.max(...ys)+Math.min(...ys))/2] }
  center.USA=[-98,39]; center.FRA=[2.3,46.6]; center.NLD=[5.3,52.1]; center.NOR=[9,61]
  return {name,center} }); return p }
