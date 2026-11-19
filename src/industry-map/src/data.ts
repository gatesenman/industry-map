export type Cite = { source:string; url:string; retrieved:string; quote?:string; note?:string }
export type Money = { valueUSD:number; date?:string; fy_end?:string; method:string; sources:Cite[]; raw?:number; unit?:string }
export type Company = { id:string; zh:string; en:string; country:string; exchange:string; ticker:string; segments:string[]; industries:string[];
  listings:{exchange:string;ticker:string;yahoo:string}[]; products:{name:string}[]; qid?:string; wikidata?:string; enwiki?:string; zhwiki?:string
  isin?:{value:string[]}&Cite; lei?:{value:string}&Cite; website?:{value:string}&Cite; inception?:{value:string}&Cite; employees?:{value:string}&Cite
  wd_products?:{value:string[]}&Cite; wd_industry?:{value:string[]}&Cite; wd_parent?:{value:string[]}&Cite; wd_subsidiaries?:{value:string[]}&Cite; wd_hq?:{value:string[]}&Cite
  marketCap:Money|null; revenue:Money|null; gleif?:{lei:string;legalName:string;jurisdiction:string;status:string;hqCity:string;hqCountry:string;url:string}
  quality:{score:number;max:number;grade:string}; identity:Cite; verify?:Record<string,VRec>; countrySplit?:{registered?:string;headquarters?:string;operating?:string}; filingTop5?:{customerShare?:number;supplierShare?:number;title?:string;date?:string;url?:string;source?:Cite} }
export type VSrc = { source:string; tier:string; value:any; cur?:string; end?:string; date?:string; url:string; note?:string; diff?:number }
export type VRec = { grade:'A'|'B'|'C'|'X'|'缺失'; conf:number; agree?:number; sources:VSrc[]; notes?:string[] }
export type Audit = { round:string; date:string; target:number; population:number; fields:{n:number;correct:number;acc:number;ci95:[number,number];method:string}; relations:{n:number;correct:number;acc:number;ci95:[number,number];method:string}
  overall:{n:number;correct:number;acc:number;ci95:[number,number];meets98:boolean;pointMeets98:boolean}; overallVerified?:{n:number;correct:number;acc:number;ci95:[number,number];meets98:boolean;pointMeets98:boolean}; relationsVerified?:{n:number;correct:number;acc:number;ci95:[number,number];note?:string}; claimBasis?:string; byField:Record<string,{n:number;correct:number}>; failures:any[]; relationFailures:any[] }
export type Verification = { generated:string; fieldStats:Record<string,Record<string,number>>; tiers:Record<string,string>; weights:Record<string,number> }
export type Segment = { id:string; industry:string; sub:string; tier:string; name:string }
export type Rel = { auto?:boolean; from:string; to:string; type:string; note:string; status:string; confidence:string; evidence:(Cite&{rejected?:string;form?:string;date?:string})[]; grade?:string; conf?:number; audit?:{verdict:string;comment:string} }
export type Series = { unit:string; annual:{end:string;value:number;form:string;filed:string}[]; quarterly:{end:string;value:number;form:string;filed:string}[]; concept:string }
export type SecRec = { cik:number; url:string; filingsUrl:string; entity:string; revenue?:Series; netIncome?:Series; grossProfit?:Series; rd?:Series; capex?:Series; shares?:{value:number;end:string} }
export type Quote = { symbol:string; price:number; currency:string; time:string; series:[string,number][]; url:string }
export type Core = { industries:{id:string;zh:string;en:string}[]; segments:Segment[]; segmentLinks:{industry:string;from:string;to:string}[]; companies:Company[]; relations:Rel[]; meta:{version:string;generated:string;lastRefresh?:string;localUpdate?:any} }
export type Micro = { sec:Record<string,SecRec>; quotes:Record<string,Quote>; fx:Record<string,{perUSD:number;time:string;url:string}>; gleif:Record<string,unknown>
  prices?:{commodities:Record<string,{zh:string;unit:string;data:[string,number][]}>; source:Cite; missing:Record<string,string>} }
export type Macro = { worldbank:Record<string,{name:string;lastUpdated:string;data:Record<string,[string,number][]>;url:string}>; imf:Record<string,{name:string;data:Record<string,[string,number][]>;url:string;note:string}>
  fred:Record<string,{name:string;data:[string,number][];url:string}>; trade?:{hs:Record<string,string>;flows:{hs:string;year:number;from:string;to:string;toName:string;value:number}[];totals:Record<string,Record<string,{year:number;value:number}>>;source:Cite}; countries:string[] }
export type Sources = { generated:string; status:Record<string,{ok:number;fail:number;detail:string;checked:string}> }
export type Changelog = { entries:{version:string;date:string;notes:string[];auto?:string[];accuracy?:any}[] }
export type Versions = { current:string; versions:{version:string;generated:string;companies:number;relations:number;relationsAB:number;industries:string[];overallVerified?:any;relationsVerified?:any}[] }
export type DB = { commodities?:any; core:Core; micro:Micro; macro:Macro; sources:Sources; verification:Verification; audit:Audit|null; changelog:Changelog; versions:Versions; SEG:Record<string,Segment>; COMP:Record<string,Company> }

export async function loadDB():Promise<DB>{
  const j=(n:string):Promise<any>=>fetch(`./data/${n}.json`).then(r=>r.ok?r.json():{}).catch(()=>({}))
  const [core,micro,macro,sources,verification,audit,changelog,versions,commodities]=await Promise.all([j('core'),j('micro'),j('macro'),j('sources'),j('verification'),j('audit'),j('changelog'),j('versions'),j('commodities')])
  return { core, micro:{sec:{},quotes:{},fx:{},gleif:{},...micro}, macro:{worldbank:{},imf:{},fred:{},countries:[],...macro}, sources:{generated:'',status:{},...sources}, verification:{generated:'',fieldStats:{},tiers:{},weights:{},...verification}, audit:audit&&audit.overall?audit:null, changelog:{entries:[],...changelog}, versions:{current:'',versions:[],...versions}, commodities,
    SEG:Object.fromEntries(core.segments.map((s:Segment)=>[s.id,s])), COMP:Object.fromEntries(core.companies.map((c:Company)=>[c.id,c])) }
}
export const ISO2to3:Record<string,string>={US:'USA',CN:'CHN',TW:'TWN',JP:'JPN',KR:'KOR',NL:'NLD',DE:'DEU',FR:'FRA',GB:'GBR',CH:'CHE',CL:'CHL',AU:'AUS',BE:'BEL',IL:'ISR',CA:'CAN',ES:'ESP',IT:'ITA',SE:'SWE',SG:'SGP'}
export const CN3:Record<string,string>={USA:'美国',CHN:'中国大陆',TWN:'中国台湾',JPN:'日本',KOR:'韩国',NLD:'荷兰',DEU:'德国',FRA:'法国',GBR:'英国',CHE:'瑞士',CHL:'智利',AUS:'澳大利亚',BEL:'比利时',ISR:'以色列',CAN:'加拿大',ESP:'西班牙',ITA:'意大利',SWE:'瑞典',SGP:'新加坡',MYS:'马来西亚',VNM:'越南',HKG:'中国香港',MEX:'墨西哥',IND:'印度',THA:'泰国',PHL:'菲律宾',IDN:'印度尼西亚',BRA:'巴西',POL:'波兰',HUN:'匈牙利',CZE:'捷克',TUR:'土耳其',ARE:'阿联酋',SAU:'沙特',RUS:'俄罗斯',ZAF:'南非',NZL:'新西兰',AUT:'奥地利',IRL:'爱尔兰',DNK:'丹麦',NOR:'挪威',FIN:'芬兰',PRT:'葡萄牙',GRC:'希腊',SVK:'斯洛伐克',ROU:'罗马尼亚',PAK:'巴基斯坦',BGD:'孟加拉国',EGY:'埃及',MAR:'摩洛哥',ARG:'阿根廷',COL:'哥伦比亚',PER:'秘鲁',UKR:'乌克兰',KAZ:'哈萨克斯坦',UZB:'乌兹别克斯坦',SVN:'斯洛文尼亚',BGR:'保加利亚',LTU:'立陶宛',EST:'爱沙尼亚',LVA:'拉脱维亚',HRV:'克罗地亚',SRB:'塞尔维亚',LUX:'卢森堡',MLT:'马耳他',CYP:'塞浦路斯',ISL:'冰岛',CRI:'哥斯达黎加',PAN:'巴拿马',DOM:'多米尼加',PRY:'巴拉圭',URY:'乌拉圭',ECU:'厄瓜多尔',NGA:'尼日利亚',KEN:'肯尼亚',GHA:'加纳',DZA:'阿尔及利亚',TUN:'突尼斯',JOR:'约旦',ISR2:'以色列',QAT:'卡塔尔',KWT:'科威特',OMN:'阿曼',BHR:'巴林',IRN:'伊朗',IRQ:'伊拉克',LKA:'斯里兰卡',KHM:'柬埔寨',MMR:'缅甸',LAO:'老挝',MNG:'蒙古',NPL:'尼泊尔',MAC:'中国澳门'}
export const cn2=(c:string)=>CN3[ISO2to3[c]]??c
export const cn3=(c:string)=>CN3[c]??c
export const fmtUSD=(v?:number|null)=>v==null||!isFinite(v)?'缺失':v>=1e12?`${(v/1e12).toFixed(2)} 万亿美元`:v>=1e8?`${(v/1e8).toFixed(v>=1e10?0:1)} 亿美元`:`${(v/1e6).toFixed(1)} 百万美元`
export const fmtNum=(v:number,unit='')=>Math.abs(v)>=1e12?(v/1e12).toFixed(2)+' 万亿'+unit:Math.abs(v)>=1e8?(v/1e8).toFixed(1)+' 亿'+unit:Math.abs(v)>=1e4?(v/1e4).toFixed(1)+' 万'+unit:v.toFixed(2)+unit
export const TIERS=['上游','中游','下游']
export const TIER_COLOR:Record<string,string>={上游:'#38bdf8',中游:'#818cf8',下游:'#fbbf24'}
export const REL_COLOR:Record<string,string>={供货:'#22c55e',竞争:'#ef4444',投资:'#a855f7',合资:'#a855f7',授权:'#06b6d4',控股:'#f97316',持股:'#f97316'}
export const HS_OF:Record<string,string>={semi:'8542',nev:'850760',pv:'854143',ce:'8542', ess:'8507', pharma:'30'}
// 环节国家集中度：优先营收（有来源），否则公司数
export function concentration(db:DB, segId:string){
  const cs=db.core.companies.filter(c=>c.segments.includes(segId))
  const withRev=cs.filter(c=>c.revenue)
  const useRev = withRev.length>=Math.max(2,cs.length*0.6)
  const w:Record<string,number>={}
  for(const c of (useRev?withRev:cs)) w[c.country]=(w[c.country]??0)+(useRev?c.revenue!.valueUSD:1)
  const tot=Object.values(w).reduce((a,b)=>a+b,0)||1
  const shares=Object.entries(w).map(([k,v])=>[k,v/tot] as [string,number]).sort((a,b)=>b[1]-a[1])
  const hhi=Math.round(shares.reduce((a,[,s])=>a+(s*100)**2,0))
  // 样本内公司年报前五大客户占比中位数（若有），作为客户集中度补充信号
  const top5s=cs.map(c=>c.filingTop5?.customerShare).filter((x):x is number=>x!=null).sort((a,b)=>a-b)
  const top5Cust=top5s.length? top5s[Math.floor(top5s.length/2)]: undefined
  return {hhi,shares,basis:useRev?'营收加权':'公司数',n:cs.length,choke: hhi>=3500 && cs.length>=4 && (shares[0]?.[1]??0)>=0.6, top:shares[0], top5Cust, top5n:top5s.length}
}


// 已验证：A 级，或 B 级（单一 T1 一手来源，且字段类型抽检通过）
export const isVerified=(g?:string)=>g==='A'||g==='B'
export const VLABEL:Record<string,string>={A:'A 多源一致',B:'B 一手单源',C:'C 二手单源',X:'X 来源冲突','缺失':'缺失','待核实':'待核实'}
// 「仅已验证」视图：未验证的数值置空、未验证关系剔除
export function verifiedDB(db:DB):DB{
  const companies=db.core.companies.map(c=>({...c,marketCap:isVerified(c.verify?.marketCap?.grade)?c.marketCap:null,revenue:isVerified(c.verify?.revenue?.grade)?c.revenue:null}))
  const relations=db.core.relations.filter(r=>isVerified(r.grade))
  return {...db,core:{...db.core,companies,relations},COMP:Object.fromEntries(companies.map(c=>[c.id,c]))}
}
export const pct=(x?:number|null)=>x==null?'—':(x*100).toFixed(1)+'%'
