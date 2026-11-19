import { Graph } from '@antv/g6'
import { exporters } from '../store'
export { Graph }
export function regExport(key:string, g:Graph){ exporters[key]={ png:()=>g.toDataURL({mode:'overall',type:'image/png'} as never) } }
export const dark=(t:string)=>t==='dark'
export function bfs(adj:Map<string,string[]>, start:string){ const seen=new Set([start]); const q=[start]; while(q.length){ const x=q.shift()!; for(const y of adj.get(x)??[]) if(!seen.has(y)){ seen.add(y); q.push(y) } } return seen }
