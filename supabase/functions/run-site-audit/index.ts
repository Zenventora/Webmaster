import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_URL = (Deno.env.get("SITERADAR_APP_URL") ?? "").replace(/\/$/, "");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM = Deno.env.get("SITERADAR_FROM_EMAIL") ?? "";
const AUDIT_TEMPLATE_ID = Deno.env.get("SITERADAR_AUDIT_TEMPLATE_ID") ?? "acc59f5f-2875-4246-83d7-2069cdb36f2b";
const USER_AGENT = "SiteRadarBot/0.2 (+https://zenventora.in; website-audit)";
const MAX_BODY_BYTES = 1_000_000;
const MAX_PAGES_HARD = 50;
const CRAWL_BUDGET_MS = 90_000;
const MAX_SITEMAP_FILES = 12;
const MAX_SITEMAP_URLS = 2000;
const FETCH_TIMEOUT_MS = 6000;

type CrawlPage = {
  requested_url: string; final_url: string | null; normalized_url: string;
  status_code: number | null; response_content_type: string | null;
  indexability_status: string; fetch_state: "pending"|"fetched"|"blocked"|"skipped"|"timeout"|"failed";
  redirect_chain: string[]; meta_snapshot: Record<string, unknown>;
  content_fingerprint: string | null; crawl_depth: number; fetched_at: string|null;
  links: Array<{url:string; anchor:string|null; rel:string[]}>;
  error?: string;
};
type Finding = { rule_id:string; category:string; severity:"critical"|"error"|"warning"|"info"|"opportunity"; title:string; description:string; recommendation:string; url:string; evidence:Record<string,unknown> };

function response(data: unknown, status=200, origin="") {
  const allowed = origin && (origin === APP_URL || origin === "http://localhost:5173" || origin === "http://127.0.0.1:5173");
  return new Response(JSON.stringify(data), { status, headers: {
    "Content-Type":"application/json",
    "Cache-Control":"no-store",
    "Vary":"Origin",
    ...(allowed ? {"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS"} : {})
  }});
}
function normalizeUrl(raw: string, base?: string): string | null {
  try {
    const u = new URL(raw, base);
    if (!["http:","https:"].includes(u.protocol) || u.username || u.password) return null;
    u.hash = "";
    for (const key of [...u.searchParams.keys()]) if (/^(utm_.+|gclid|fbclid|mc_cid|mc_eid)$/i.test(key)) u.searchParams.delete(key);
    if ((u.protocol==="https:" && u.port==="443") || (u.protocol==="http:" && u.port==="80")) u.port="";
    if (u.pathname.length>1) u.pathname=u.pathname.replace(/\/{2,}/g,"/");
    return u.toString();
  } catch { return null; }
}
function ipv4Number(ip:string):number|null {
  const p=ip.split(".");
  if(p.length!==4 || p.some(x=>!/^\d+$/.test(x)||Number(x)>255)) return null;
  return p.reduce((n,x)=>((n*256)+Number(x))>>>0,0);
}
function privateV4(ip:string):boolean {
  const n=ipv4Number(ip); if(n===null)return true;
  const inRange=(base:number,mask:number)=>((n&mask)>>>0)===(base&mask);
  return n===0 || inRange(0x0a000000,0xff000000) || inRange(0x7f000000,0xff000000) ||
    inRange(0xa9fe0000,0xffff0000) || inRange(0xac100000,0xfff00000) ||
    inRange(0xc0a80000,0xffff0000) || inRange(0x64400000,0xffc00000) ||
    inRange(0xc0000000,0xffffff00) || inRange(0xc0000200,0xffffff00) ||
    inRange(0xc0586300,0xffffff00) || inRange(0xc6120000,0xfffe0000) ||
    inRange(0xc6336400,0xffffff00) || inRange(0xcb007100,0xffffff00) ||
    n>=0xe0000000;
}
function privateV6(ip:string):boolean {
  const s=ip.toLowerCase().split("%")[0];
  if(s==="::" || s==="::1" || s.startsWith("fe8") || s.startsWith("fe9") || s.startsWith("fea") || s.startsWith("feb") || s.startsWith("fc") || s.startsWith("fd") || s.startsWith("ff")) return true;
  if(s.startsWith("::ffff:")) {
    const tail=s.slice(7);
    if(tail.includes(".")) return privateV4(tail);
    return true;
  }
  const first=parseInt(s.split(":")[0]||"0",16);
  return !(first>=0x2000 && first<=0x3fff);
}
async function assertPublicHost(url: URL): Promise<void> {
  const host=url.hostname.toLowerCase().replace(/^\[|\]$/g,"");
  if(!host || host==="localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".test") || host.endsWith(".invalid")) throw new Error("Private or reserved hostname is blocked.");
  if(host.includes(":")) { if(privateV6(host)) throw new Error("Private or reserved IP address is blocked."); return; }
  if(/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) { if(privateV4(host)) throw new Error("Private or reserved IP address is blocked."); return; }
  let addresses:string[]=[];
  try { addresses.push(...(await Deno.resolveDns(host,"A")).map(String)); } catch { /* no IPv4 record */ }
  try { addresses.push(...(await Deno.resolveDns(host,"AAAA")).map(String)); } catch { /* no IPv6 record */ }
  if(!addresses.length) throw new Error("Hostname did not resolve to a public address.");
  if(addresses.some(ip=>ip.includes(":")?privateV6(ip):privateV4(ip))) throw new Error("Hostname resolves to a private or reserved IP address.");
}
async function safeFetch(raw:string, allowedHostname:string, deadlineAt=Number.POSITIVE_INFINITY):Promise<{url:string;response:Response;body:string;chain:string[]}> {
  let current=new URL(raw); const chain:string[]=[];
  for(let hop=0;hop<=4;hop++){
    if(!["http:","https:"].includes(current.protocol) || current.username || current.password) throw new Error("Unsafe URL or protocol.");
    if(current.hostname.toLowerCase()!==allowedHostname.toLowerCase()) throw new Error("Cross-host redirect blocked by crawl scope.");
    if(Date.now()>=deadlineAt)throw new Error("Audit time budget exhausted.");
    await assertPublicHost(current);
    const remainingMs=deadlineAt-Date.now();
    if(remainingMs<=0)throw new Error("Audit time budget exhausted.");
    const timeoutMs=Math.max(1,Math.min(FETCH_TIMEOUT_MS,remainingMs));
    const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),timeoutMs);
    let res:Response;
    try { res=await fetch(current.toString(),{method:"GET",redirect:"manual",signal:controller.signal,headers:{"User-Agent":USER_AGENT,"Accept":"text/html,application/xhtml+xml,application/xml,text/xml,text/plain,application/gzip,application/x-gzip;q=0.9,*/*;q=0.5"}}); }
    catch(e){ clearTimeout(timer); if(controller.signal.aborted&&Date.now()>=deadlineAt)throw new Error("Audit time budget exhausted."); if(controller.signal.aborted)throw new Error("Fetch timed out."); throw e; }
    if([301,302,303,307,308].includes(res.status)){
      clearTimeout(timer);
      const location=res.headers.get("location");
      if(!location){try{await res.body?.cancel();}catch{}return {url:current.toString(),response:res,body:"",chain};}
      const next=new URL(location,current);
      try{await res.body?.cancel();}catch{}
      if(next.hostname.toLowerCase()!==allowedHostname.toLowerCase()) return {url:current.toString(),response:res,body:"",chain:[...chain,next.toString()]};
      chain.push(current.toString()); current=next; continue;
    }
    const type=res.headers.get("content-type")||"";
    let body="";
    try {
      if(type.includes("text/html")||type.includes("application/xhtml+xml")||type.includes("xml")||type.startsWith("text/")||type.includes("gzip")||current.pathname.toLowerCase().endsWith(".gz")){
        const reader=res.body?.getReader();
        if(reader){
          const chunks:Uint8Array[]=[];let total=0;
          try {
            while(true){if(Date.now()>=deadlineAt)throw new Error("Audit time budget exhausted.");const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>MAX_BODY_BYTES){await reader.cancel();break;}chunks.push(value);}
          } finally { reader.releaseLock(); }
          const merged=new Uint8Array(chunks.reduce((n,c)=>n+c.length,0));let off=0;for(const chunk of chunks){merged.set(chunk,off);off+=chunk.length;}
          let decodedBytes=merged;
          if(type.toLowerCase().includes("gzip")||current.pathname.toLowerCase().endsWith(".gz")){
            const decompressed=await new Response(new Blob([merged]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
            if(decompressed.byteLength>MAX_BODY_BYTES)throw new Error("Compressed response expands beyond the 1 MB body limit.");
            decodedBytes=new Uint8Array(decompressed);
          }
          body=new TextDecoder("utf-8",{fatal:false}).decode(decodedBytes);
        }
      } else { try{await res.body?.cancel();}catch{} }
    } catch(e){if(controller.signal.aborted&&Date.now()>=deadlineAt)throw new Error("Audit time budget exhausted.");if(controller.signal.aborted)throw new Error("Fetch timed out while reading the response.");throw e;}
    finally {clearTimeout(timer);}
    return {url:current.toString(),response:res,body,chain};
  }
  throw new Error("Redirect limit exceeded.");
}
function decodeHtml(s:string):string{return s.replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Math.min(0x10ffff,Number(n))));}
function textContent(s:string):string{return decodeHtml(s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim());}
function attr(tag:string,name:string):string|null { const m=tag.match(new RegExp("\\b"+name+"\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))","i"));return m?decodeHtml(m[1]??m[2]??m[3]??""):null; }
function findMeta(html:string,name:string):string|null {
  const tags=html.match(/<meta\b[^>]*>/gi)||[];
  for(const t of tags){const n=attr(t,"name")||attr(t,"property");if(n?.toLowerCase()===name.toLowerCase())return attr(t,"content");}
  return null;
}
function parseHtml(html:string,base:string){
  const title=textContent((html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||"");
  const description=findMeta(html,"description");
  const robots=findMeta(html,"robots")||findMeta(html,"googlebot")||"";
  const h1=(html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi)||[]).map(x=>textContent(x));
  const canonicalTag=(html.match(/<link\b[^>]*>/gi)||[]).find(t=>/\brel\s*=\s*["'][^"']*canonical/i.test(t));
  const canonical=canonicalTag?attr(canonicalTag,"href"):null;
  const lang=attr((html.match(/<html\b[^>]*>/i)||[])[0]||"","lang");
  const links:Array<{url:string;anchor:string|null;rel:string[]}>=[];const seen=new Set<string>();
  for(const m of html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a\s*>/gi)){
    const tag=(m[0].match(/^<a\b[^>]*>/i)||[])[0]||"";const href=attr(tag,"href");if(!href)continue;
    const url=normalizeUrl(href,base);if(!url||seen.has(url))continue;seen.add(url);
    links.push({url,anchor:textContent(m[0]).slice(0,250)||null,rel:(attr(tag,"rel")||"").toLowerCase().split(/\s+/).filter(Boolean)});
    if(links.length>=500)break;
  }
  const canonicalUrl=canonical?normalizeUrl(canonical,base):null;
  const viewport=findMeta(html,"viewport");
  const charsetTag=(html.match(/<meta\b[^>]*\bcharset\s*=\s*["']?[^ \t"'/>]+[^>]*>/i)||[])[0]||"";
  const contentTypeTag=(html.match(/<meta\b[^>]*http-equiv\s*=\s*["']content-type["'][^>]*>/i)||[])[0]||"";
  const charset=attr(charsetTag,"charset")||(contentTypeTag?attr(contentTypeTag,"content"):"");
  const images=html.match(/<img\b[^>]*>/gi)||[];
  const imagesWithoutAlt=images.filter(t=>attr(t,"alt")===null).length;
  const structuredDataCount=(html.match(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>/gi)||[]).length;
  const ogTitle=findMeta(html,"og:title");
  const ogDescription=findMeta(html,"og:description");
  return {title,description,h1,robots,canonical:canonicalUrl,language:lang,viewport,charset,imagesCount:images.length,imagesWithoutAlt,structuredDataCount,ogTitle,ogDescription,links};
}
function robotsRules(body:string){
  const rules:Array<{allow:boolean;path:string}>=[];let applies=false;
  for(const raw of body.split(/\r?\n/)){const line=raw.split("#")[0].trim();if(!line)continue;const i=line.indexOf(":");if(i<0)continue;const key=line.slice(0,i).trim().toLowerCase();const val=line.slice(i+1).trim();
    if(key==="user-agent"){applies=val==="*"||/vadxbot|siteradarbot/i.test(val);continue;}
    if(applies&&(key==="allow"||key==="disallow")&&val)rules.push({allow:key==="allow",path:val});
  }
  return (path:string)=>{let best: {allow:boolean;path:string}|null=null;for(const r of rules){const p=r.path.replace(/\$$/,"");if(path.startsWith(p)&&(!best||p.length>best.path.length||(p.length===best.path.length&&r.allow)))best=r;}return !best||best.allow;};
}
function publicUrlOnly(raw:string,host:string):string|null{const u=normalizeUrl(raw);if(!u)return null;try{const x=new URL(u);if(x.hostname.toLowerCase()!==host.toLowerCase())return null;return u;}catch{return null;}}
function escapeHtml(value:string):string{return value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/\x27/g,"&#39;");}
async function sha256(value:string){const bytes=new TextEncoder().encode(value);const hash=await crypto.subtle.digest("SHA-256",bytes);return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,"0")).join("");}

Deno.serve(async (req:Request)=>{
  const origin=req.headers.get("origin")||"";
  if(req.method==="OPTIONS")return response({ok:true},200,origin);
  if(req.method!=="POST")return response({error:"POST required"},405,origin);
  const authHeader=req.headers.get("authorization")||"";
  const token=authHeader.replace(/^Bearer\s+/i,"");
  if(!token)return response({error:"Sign in is required."},401,origin);
  if(!SUPABASE_URL||!ANON_KEY||!SERVICE_ROLE_KEY)return response({error:"Crawler server configuration is incomplete."},503,origin);
  let auditRunId:string|null=null;let auditJobId:string|null=null;let service:any=null;
  try{
    const userClient=createClient(SUPABASE_URL,ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:"Bearer "+token}}});
    const {data:userResult,error:userError}=await userClient.auth.getUser(token);
    if(userError||!userResult.user)return response({error:"Your session is invalid or expired. Sign in again."},401,origin);
    const user=userResult.user;
    const body=await req.json().catch(()=>({}));
    const siteId=typeof body.site_id==="string"?body.site_id:"";
    const requestedLimit=Number(body.max_pages||0);
    if(!/^[0-9a-f-]{36}$/i.test(siteId))return response({error:"A valid site_id is required."},400,origin);
    service=createClient(SUPABASE_URL,SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:site,error:siteError}=await service.from("sites").select("*").eq("id",siteId).maybeSingle();
    if(siteError||!site)return response({error:"Website not found or access denied."},404,origin);
    const {data:membership,error:membershipError}=await service.from("workspace_members").select("role,joined_at").eq("workspace_id",site.workspace_id).eq("user_id",user.id).maybeSingle();
    if(membershipError||!membership||!membership.joined_at||membership.role==="viewer")return response({error:"You do not have permission to run audits for this website."},403,origin);

    // Expire trials before resolving the effective edition. This call is idempotent.
    await service.rpc("expire_siteradar_trials");
    const {data:subscription,error:subscriptionError}=await service.from("workspace_subscriptions")
      .select("plan_key,status,trial_ends_at,current_period_end").eq("workspace_id",site.workspace_id).maybeSingle();
    if(subscriptionError)return response({error:"Could not verify the workspace edition."},503,origin);
    const now=Date.now();
    let effectivePlan="free";
    if(subscription){
      const trialValid=subscription.status!=="trialing"||!subscription.trial_ends_at||new Date(subscription.trial_ends_at).getTime()>now;
      const periodValid=!subscription.current_period_end||new Date(subscription.current_period_end).getTime()>now;
      if(trialValid&&periodValid&&["trialing","active","past_due","cancel_at_period_end"].includes(subscription.status)){
        effectivePlan=subscription.plan_key;
      }
    }
    const {data:plan,error:planError}=await service.from("plan_catalog").select("limits,features,display_name").eq("plan_key",effectivePlan).single();
    if(planError||!plan)return response({error:"Could not verify edition limits."},503,origin);
    if(plan.features?.technical_audit_mvp!==true)return response({error:"Technical audits are not enabled for this edition."},403,origin);
    const planPageLimit=Math.max(1,Math.min(MAX_PAGES_HARD,Number(plan.limits?.pages_per_audit||15)));
    const maxPages=Math.max(1,Math.min(planPageLimit,Number.isFinite(requestedLimit)&&requestedLimit>0?Math.floor(requestedLimit):planPageLimit));
    const monthlyAuditLimit=Math.max(1,Number(plan.limits?.audits_per_month||5));
    const monthStart=new Date();monthStart.setUTCDate(1);monthStart.setUTCHours(0,0,0,0);
    const {count:monthlyAuditCount,error:usageError}=await service.from("audit_runs").select("id",{count:"exact",head:true})
      .eq("workspace_id",site.workspace_id).gte("created_at",monthStart.toISOString());
    if(usageError)return response({error:"Could not verify monthly audit usage."},503,origin);
    if((monthlyAuditCount??0)>=monthlyAuditLimit)return response({
      error:`Your ${plan.display_name||effectivePlan} edition has used ${monthlyAuditCount??0} of ${monthlyAuditLimit} audit runs this month. Upgrade your edition or wait until the next month.`,
      code:"PLAN_AUDIT_LIMIT_REACHED",plan_key:effectivePlan,used:monthlyAuditCount??0,limit:monthlyAuditLimit
    },429,origin);

    const start=normalizeUrl(site.start_url);
    if(!start)return response({error:"The website URL is invalid."},400,origin);
    const startUrl=new URL(start);
    const crawlStartedAt=Date.now();
    const crawlDeadline=crawlStartedAt+CRAWL_BUDGET_MS;
    await assertPublicHost(startUrl);
    const config={max_pages:maxPages,max_depth:3,request_timeout_ms:FETCH_TIMEOUT_MS,body_limit_bytes:MAX_BODY_BYTES,robots_respected:true,js_rendering:false,scope:"same-host",engine_version:"siteradar-crawl-mvp-0.2"};
    const {data:run,error:runError}=await service.from("audit_runs").insert({site_id:site.id,workspace_id:site.workspace_id,initiated_by:user.id,status:"running",started_at:new Date().toISOString(),config_snapshot:config,summary:{}}).select("id").single();
    if(runError||!run)throw new Error("Could not create an audit run.");
    auditRunId=run.id;
    const {data:job,error:jobError}=await service.from("audit_jobs").insert({audit_run_id:auditRunId,status:"running",attempts:1,started_at:new Date().toISOString(),heartbeat_at:new Date().toISOString()}).select("id").single();
    if(jobError||!job)throw new Error("Could not create audit job.");
    auditJobId=job.id;
    const originUrl=new URL(start).origin;
    const host=startUrl.hostname;
    let robotsBody="";
    try{const rb=await safeFetch(new URL("/robots.txt",originUrl).toString(),host,crawlDeadline);if(rb.response.status>=200&&rb.response.status<300)robotsBody=rb.body;}catch{}
    const robotsAllowed=robotsRules(robotsBody);
    const sitemapCandidates:string[]=[];
    if(typeof site.sitemap_url==="string"&&site.sitemap_url)sitemapCandidates.push(site.sitemap_url);
    for(const m of robotsBody.matchAll(/^\s*sitemap\s*:\s*(\S+)/gim))sitemapCandidates.push(m[1]);
    sitemapCandidates.push(new URL("/sitemap.xml",originUrl).toString());
    const sitemapUrls=new Set<string>();
    const discovered=new Set<string>();
    const sitemapQueue:Array<{url:string;depth:number}>=sitemapCandidates.slice(0,5).map(url=>({url,depth:0}));
    while(sitemapQueue.length&&sitemapUrls.size<MAX_SITEMAP_FILES&&discovered.size<MAX_SITEMAP_URLS&&Date.now()<crawlDeadline){
      const item=sitemapQueue.shift()!;
      const safe=publicUrlOnly(item.url,host);if(!safe||sitemapUrls.has(safe))continue;
      sitemapUrls.add(safe);
      try{
        const sm=await safeFetch(safe,host,crawlDeadline);if(sm.response.status<200||sm.response.status>=300)continue;
        const locations=[...sm.body.matchAll(/<loc\b[^>]*>\s*([\s\S]*?)\s*<\/loc>/gi)].map(m=>decodeHtml(m[1].trim())).filter(Boolean);
        const isIndex=/<sitemapindex\b/i.test(sm.body);
        for(const loc of locations){
          const u=publicUrlOnly(loc,host);if(!u)continue;
          if(isIndex&&item.depth<2){if(!sitemapUrls.has(u)&&sitemapQueue.length<MAX_SITEMAP_FILES)sitemapQueue.push({url:u,depth:item.depth+1});}
          else if(!isIndex&&discovered.size<MAX_SITEMAP_URLS)discovered.add(u);
        }
      }catch{}
    }
    const queue:Array<{url:string;depth:number}>=[{url:start,depth:0}];const queued=new Set([start]);
    for(const u of discovered){if(!queued.has(u)&&queue.length<MAX_SITEMAP_URLS+1){queue.push({url:u,depth:1});queued.add(u);}}
    const crawled:CrawlPage[]=[];const findings:Finding[]=[];let robotsBlocked=0;let fetchFailures=0;
    while(queue.length&&crawled.length<maxPages&&Date.now()<crawlDeadline){
      const item=queue.shift()!;const u=new URL(item.url);
      if(!robotsAllowed(u.pathname)){robotsBlocked++;crawled.push({requested_url:item.url,final_url:null,normalized_url:item.url,status_code:null,response_content_type:null,indexability_status:"blocked_by_robots",fetch_state:"blocked",redirect_chain:[],meta_snapshot:{robots_allowed:false},content_fingerprint:null,crawl_depth:item.depth,fetched_at:null,links:[]});continue;}
      try{
        const requestStartedAt=Date.now();const got=await safeFetch(item.url,host,crawlDeadline);const responseTimeMs=Date.now()-requestStartedAt;const status=got.response.status;const contentType=got.response.headers.get("content-type")||null;
        const securityHeaders={strict_transport_security:got.response.headers.get("strict-transport-security"),content_security_policy:got.response.headers.get("content-security-policy"),x_content_type_options:got.response.headers.get("x-content-type-options"),referrer_policy:got.response.headers.get("referrer-policy"),permissions_policy:got.response.headers.get("permissions-policy"),x_frame_options:got.response.headers.get("x-frame-options")};
        const isHtml=!!contentType&&(contentType.includes("text/html")||contentType.includes("application/xhtml+xml"));
        const parsed=isHtml?parseHtml(got.body,got.url):{title:"",description:null,h1:[],robots:"",canonical:null,language:null,viewport:null,charset:null,imagesCount:0,imagesWithoutAlt:0,structuredDataCount:0,ogTitle:null,ogDescription:null,links:[] as Array<{url:string;anchor:string|null;rel:string[]}>};
        const noindex=/\bnoindex\b/i.test(parsed.robots)||/noindex/i.test(got.response.headers.get("x-robots-tag")||"");
        const indexability=status>=200&&status<300&&isHtml&&!noindex?"indexable":noindex?"noindex":status>=400?"error":"unknown";
        const page:CrawlPage={requested_url:item.url,final_url:got.url,normalized_url:item.url,status_code:status,response_content_type:contentType,indexability_status:indexability,fetch_state:"fetched",redirect_chain:got.chain,meta_snapshot:{title:parsed.title,description:parsed.description,h1:parsed.h1,robots:parsed.robots,canonical:parsed.canonical,language:parsed.language,viewport:parsed.viewport,charset:parsed.charset,images_count:parsed.imagesCount,images_without_alt:parsed.imagesWithoutAlt,structured_data_count:parsed.structuredDataCount,og_title:parsed.ogTitle,og_description:parsed.ogDescription,html_bytes:new TextEncoder().encode(got.body).length,response_time_ms:responseTimeMs,security_headers:securityHeaders,robots_allowed:true,js_rendered:false},content_fingerprint:got.body?await sha256(got.body):null,crawl_depth:item.depth,fetched_at:new Date().toISOString(),links:parsed.links};
        crawled.push(page);
        const addFinding=(f:Omit<Finding,"url">)=>findings.push({...f,url:item.url,evidence:{...f.evidence,status_code:status,title:parsed.title}});
        if(responseTimeMs>2500)addFinding({rule_id:"slow-server-response",category:"performance",severity:"warning",title:"Slow server response",description:"The page took "+responseTimeMs+" ms to respond to the crawler request.",recommendation:"Review server processing, cache configuration and hosting latency. This is a crawler request-time signal, not a Lighthouse or Core Web Vitals measurement.",evidence:{response_time_ms:responseTimeMs}});
        if(item.depth===0){
          if(new URL(got.url).protocol==="https:"&&!securityHeaders.strict_transport_security)addFinding({rule_id:"missing-hsts",category:"security",severity:"warning",title:"HTTP Strict Transport Security header missing",description:"The HTTPS homepage response did not include Strict-Transport-Security.",recommendation:"Review whether HSTS should be enabled after confirming HTTPS coverage for the whole site and all required subdomains.",evidence:{header:"strict-transport-security"}});
          if(!securityHeaders.content_security_policy)addFinding({rule_id:"missing-csp",category:"security",severity:"info",title:"Content Security Policy header not detected",description:"The homepage response did not include a Content-Security-Policy header.",recommendation:"Review a suitable Content Security Policy for your scripts, styles, frames and other resources. Test changes before enforcing them.",evidence:{header:"content-security-policy"}});
          if((securityHeaders.x_content_type_options||"").toLowerCase()!=="nosniff")addFinding({rule_id:"missing-nosniff",category:"security",severity:"warning",title:"X-Content-Type-Options nosniff not detected",description:"The homepage response did not set X-Content-Type-Options to nosniff.",recommendation:"Consider adding X-Content-Type-Options: nosniff after verifying correct content types for served resources.",evidence:{header:"x-content-type-options",observed:securityHeaders.x_content_type_options}});
          if(!securityHeaders.referrer_policy)addFinding({rule_id:"missing-referrer-policy",category:"security",severity:"info",title:"Referrer-Policy header not detected",description:"The homepage response did not include a Referrer-Policy header.",recommendation:"Choose an appropriate Referrer-Policy for your privacy and analytics needs.",evidence:{header:"referrer-policy"}});
          if(!securityHeaders.x_frame_options&&!/frame-ancestors/i.test(securityHeaders.content_security_policy||""))addFinding({rule_id:"missing-frame-protection",category:"security",severity:"warning",title:"Frame embedding policy not detected",description:"Neither X-Frame-Options nor a CSP frame-ancestors directive was detected on the homepage.",recommendation:"Review whether this site should restrict framing to reduce clickjacking risk. Choose a policy compatible with legitimate embeds.",evidence:{x_frame_options:securityHeaders.x_frame_options,content_security_policy:securityHeaders.content_security_policy}});
        }
        if(status>=400)addFinding({rule_id:"page-http-error",category:"technical-seo",severity:status>=500?"error":"warning",title:status>=500?"Page returns a server error":"Page returns an HTTP error",description:"The crawler received an HTTP "+status+" response for this URL.",recommendation:"Check the URL, server response, redirects and internal links. Confirm whether this page should exist and be indexable.",evidence:{status_code:status}});
        if(isHtml&&status>=200&&status<300){
          if(!parsed.title)addFinding({rule_id:"missing-title",category:"on-page-seo",severity:"warning",title:"Missing page title",description:"No non-empty HTML title was found.",recommendation:"Add a unique, descriptive title that accurately describes this page.",evidence:{}});
          if(!parsed.description)addFinding({rule_id:"missing-meta-description",category:"on-page-seo",severity:"opportunity",title:"Missing meta description",description:"No meta description was found in the fetched HTML.",recommendation:"Add a concise, useful description. Search engines may generate their own snippet, so this is a recommendation rather than a ranking guarantee.",evidence:{}});
          if(parsed.h1.length===0)addFinding({rule_id:"missing-h1",category:"on-page-seo",severity:"warning",title:"Missing H1 heading",description:"No H1 heading was found in the fetched HTML.",recommendation:"Add a clear main heading when it improves page structure and user understanding.",evidence:{}});
          if(parsed.h1.length>1)addFinding({rule_id:"multiple-h1",category:"on-page-seo",severity:"info",title:"Multiple H1 headings",description:"More than one H1 was detected. This is a review hint, not automatically an SEO error.",recommendation:"Review heading hierarchy and ensure the main topic is clear to assistive technology and readers.",evidence:{h1_count:parsed.h1.length}});
          if(!parsed.canonical)addFinding({rule_id:"missing-canonical",category:"technical-seo",severity:"info",title:"Canonical link not found",description:"No canonical link element was found in the fetched HTML.",recommendation:"Review whether this page needs an explicit canonical URL, especially if equivalent URLs can be accessed.",evidence:{}});
          if(parsed.canonical&&new URL(parsed.canonical).hostname.toLowerCase()!==host.toLowerCase())addFinding({rule_id:"external-canonical",category:"technical-seo",severity:"warning",title:"Canonical points to another host",description:"The canonical URL points outside the current crawl hostname.",recommendation:"Verify that this cross-host canonical is intentional and points to the preferred duplicate page.",evidence:{canonical:parsed.canonical}});
          if(parsed.title.length>60)addFinding({rule_id:"title-too-long",category:"on-page-seo",severity:"info",title:"Page title is long",description:"The title contains "+parsed.title.length+" characters. Display truncation depends on device and query.",recommendation:"Review whether the title can be made more concise while retaining the page's main topic.",evidence:{title_length:parsed.title.length}});
          if(parsed.description&&parsed.description.length>160)addFinding({rule_id:"meta-description-too-long",category:"on-page-seo",severity:"info",title:"Meta description is long",description:"The meta description contains "+parsed.description.length+" characters. Snippet display varies by query and device.",recommendation:"Review whether the description can be shortened without losing useful context.",evidence:{description_length:parsed.description.length}});
          if(!parsed.viewport)addFinding({rule_id:"missing-viewport",category:"technical-seo",severity:"warning",title:"Viewport meta tag missing",description:"No viewport meta tag was detected in the HTML.",recommendation:"Add a responsive viewport declaration for mobile browser layout.",evidence:{}});
          if(!parsed.language)addFinding({rule_id:"missing-html-language",category:"accessibility",severity:"info",title:"HTML language not declared",description:"The root HTML element has no lang attribute.",recommendation:"Set an appropriate lang attribute on the HTML element to help assistive technology choose pronunciation.",evidence:{}});
          if(Number(parsed.imagesWithoutAlt)>0)addFinding({rule_id:"images-missing-alt",category:"accessibility",severity:"warning",title:"Images missing alt attributes",description:String(parsed.imagesWithoutAlt)+" image elements have no alt attribute.",recommendation:"Provide appropriate text alternatives for informative images; use empty alt text for decorative images.",evidence:{images_without_alt:parsed.imagesWithoutAlt,images_total:parsed.imagesCount}});
          if(noindex)addFinding({rule_id:"page-noindex",category:"technical-seo",severity:"info",title:"Page is marked noindex",description:"A robots directive indicates this page should not be indexed.",recommendation:"Confirm that the noindex directive is intentional for this page.",evidence:{robots:parsed.robots,x_robots_tag:got.response.headers.get("x-robots-tag")}});
          if(got.chain.length>0)addFinding({rule_id:"redirected-page-url",category:"links",severity:"info",title:"Page redirects before loading",description:"The requested URL passed through "+got.chain.length+" redirect(s).",recommendation:"Update internal links to the final preferred URL where practical, and avoid unnecessary redirect chains.",evidence:{redirect_chain:got.chain,final_url:got.url}});
          for(const link of parsed.links){const target=publicUrlOnly(link.url,host);if(target&&!queued.has(target)&&item.depth<3&&queue.length<1000){queue.push({url:target,depth:item.depth+1});queued.add(target);}}
        }
      }catch(e){
        fetchFailures++;const message=e instanceof Error?e.message:"Fetch failed";const state: CrawlPage["fetch_state"]=/timed out/i.test(message)?"timeout":/blocked|private|reserved|redirect|hostname/i.test(message)?"blocked":"failed";
        crawled.push({requested_url:item.url,final_url:null,normalized_url:item.url,status_code:null,response_content_type:null,indexability_status:"unknown",fetch_state:state,redirect_chain:[],meta_snapshot:{error:message},content_fingerprint:null,crawl_depth:item.depth,fetched_at:null,links:[],error:message});
        findings.push({rule_id:"page-fetch-failed",category:"technical-seo",severity:state==="timeout"?"warning":"error",title:state==="timeout"?"Page fetch timed out":"Page could not be fetched",description:"VADX could not complete a safe HTTP fetch for this URL: "+message,recommendation:"Verify that the page is publicly reachable, resolves to public IP addresses, and responds within the crawl timeout. Blocked and unavailable pages are not treated as passing.",url:item.url,evidence:{fetch_state:state,error:message}});
      }
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    const pageRows=crawled.map(p=>({audit_run_id:auditRunId,site_id:site.id,workspace_id:site.workspace_id,requested_url:p.requested_url,final_url:p.final_url,normalized_url:p.normalized_url,status_code:p.status_code,response_content_type:p.response_content_type,indexability_status:p.indexability_status,fetch_state:p.fetch_state,redirect_chain:p.redirect_chain,meta_snapshot:p.meta_snapshot,content_fingerprint:p.content_fingerprint,crawl_depth:p.crawl_depth,fetched_at:p.fetched_at,inlinks_count:0,outlinks_count:p.links.length}));
    const {data:savedPages,error:pageError}=await service.from("pages").insert(pageRows).select("id,normalized_url,status_code,fetch_state");
    if(pageError)throw new Error("Could not save crawl pages: "+pageError.message);
    const pageByUrl=new Map<string,{id:string;status_code:number|null;fetch_state:string}>((savedPages||[]).map((p:any)=>[p.normalized_url,p]));
    const linkRows:any[]=[];
    for(const p of crawled){const source=pageByUrl.get(p.normalized_url);if(!source)continue;for(const l of p.links){const target=publicUrlOnly(l.url,host);let targetPage=target?pageByUrl.get(target):undefined;linkRows.push({audit_run_id:auditRunId,source_page_id:source.id,target_url:l.url,normalized_target_url:target||l.url,target_page_id:targetPage?.id||null,link_type:target?"internal":"external",anchor_text:l.anchor,rel_tokens:l.rel,http_status:targetPage?.status_code??null});}}
    for(let i=0;i<linkRows.length;i+=500){const {error}=await service.from("page_links").insert(linkRows.slice(i,i+500));if(error)throw new Error("Could not save link data: "+error.message);}
    // Compare duplicate metadata/content within the current bounded crawl.
    const grouped=(field:"title"|"description"|"content_fingerprint")=>{
      const groups=new Map<string,CrawlPage[]>();
      for(const p of crawled){if(p.fetch_state!=="fetched"||p.status_code===null||p.status_code<200||p.status_code>=300)continue;
        const rawValue=field==="content_fingerprint"?p.content_fingerprint:p.meta_snapshot[field];
        if(typeof rawValue!=="string"||!rawValue.trim())continue;
        const key=rawValue.trim().toLowerCase();const list=groups.get(key)||[];list.push(p);groups.set(key,list);
      }
      return [...groups.values()].filter(group=>group.length>1);
    };
    for(const group of grouped("title"))for(const p of group)findings.push({rule_id:"duplicate-title",category:"on-page-seo",severity:"warning",title:"Duplicate page title",description:"This title is shared by "+group.length+" crawled pages.",recommendation:"Review whether each page can have a unique title that reflects its distinct purpose.",url:p.normalized_url,evidence:{duplicate_urls:group.map(x=>x.normalized_url),title:p.meta_snapshot.title}});
    for(const group of grouped("description"))for(const p of group)findings.push({rule_id:"duplicate-meta-description",category:"on-page-seo",severity:"info",title:"Duplicate meta description",description:"This description is shared by "+group.length+" crawled pages.",recommendation:"Consider writing a page-specific description where it helps users understand each page.",url:p.normalized_url,evidence:{duplicate_urls:group.map(x=>x.normalized_url)}});
    for(const group of grouped("content_fingerprint"))for(const p of group)findings.push({rule_id:"duplicate-content-candidate",category:"content",severity:"info",title:"Duplicate HTML response candidate",description:"These pages have the same fetched response fingerprint.",recommendation:"Review whether these URLs should be consolidated, redirected or assigned an appropriate canonical.",url:p.normalized_url,evidence:{duplicate_urls:group.map(x=>x.normalized_url)}});
    // A linked internal URL that returned 4xx/5xx is a confirmed broken-link finding.
    for(const p of crawled){const source=pageByUrl.get(p.normalized_url);if(!source)continue;for(const l of p.links){const target=publicUrlOnly(l.url,host);const targetPage=target?pageByUrl.get(target):undefined;if(targetPage&&targetPage.status_code!==null&&targetPage.status_code>=400)findings.push({rule_id:"broken-internal-link",category:"links",severity:targetPage.status_code>=500?"error":"warning",title:"Broken internal link",description:"An internal link points to a URL returning HTTP "+targetPage.status_code+".",recommendation:"Update the destination URL, restore the missing page, or remove/replace the link if it is no longer needed.",url:p.normalized_url,evidence:{target_url:l.url,target_status:targetPage.status_code,anchor_text:l.anchor}});}}
    // Update inlink counts from the links persisted in this audit.
    const inlinks=new Map<string,number>();for(const l of linkRows)if(l.target_page_id)inlinks.set(l.target_page_id,(inlinks.get(l.target_page_id)||0)+1);
    for(const p of (savedPages||[])){const count=inlinks.get(p.id)||0;await service.from("pages").update({inlinks_count:count}).eq("id",p.id);}
    const uniqueFindings=new Map<string,Finding>();for(const f of findings){const key=f.rule_id+"|"+f.url+"|"+String(f.evidence.target_url||"");if(!uniqueFindings.has(key))uniqueFindings.set(key,f);}
    let occurrenceCount=0;
    for(const f of uniqueFindings.values()){
      const page=pageByUrl.get(f.url);const issueUrl=String(f.evidence.target_url||f.url);
      let issueQuery=service.from("issues").select("id,status").eq("site_id",site.id).eq("rule_id",f.rule_id).filter("metadata->>url","eq",issueUrl).limit(1);
      const {data:existing}=await issueQuery.maybeSingle();
      let issueId:string;
      const issuePayload={workspace_id:site.workspace_id,site_id:site.id,rule_id:f.rule_id,rule_version:"0.1",category:f.category,severity:f.severity,title:f.title,description:f.description,recommendation:f.recommendation,status:existing?.status==="ignored"?"ignored":"open",last_seen_at:new Date().toISOString(),last_audit_run_id:auditRunId,metadata:{url:issueUrl,page_url:f.url,evidence:f.evidence}};
      if(existing?.id){issueId=existing.id;await service.from("issues").update(issuePayload).eq("id",issueId);}
      else {const {data:newIssue,error:newIssueError}=await service.from("issues").insert({...issuePayload,first_seen_at:new Date().toISOString()}).select("id").single();if(newIssueError||!newIssue)throw new Error("Could not save issue: "+(newIssueError?.message||"unknown"));issueId=newIssue.id;}
      const {error:occError}=await service.from("issue_occurrences").insert({issue_id:issueId,audit_run_id:auditRunId,page_id:page?.id||null,evidence:f.evidence,observed_at:new Date().toISOString()});
      if(!occError)occurrenceCount++;
    }

    // Only close findings on source pages that were fetched again in this audit.
    // Pages left outside the crawl/time budget keep their issue state unchanged.
    const scannedPageUrls=new Set(crawled.filter(page=>page.fetch_state==="fetched").map(page=>page.normalized_url));
    const currentIssueKeys=new Set([...uniqueFindings.values()].map(f=>f.rule_id+"|"+String(f.evidence.target_url||f.url)));
    if(scannedPageUrls.size){
      const {data:priorIssues,error:priorIssuesError}=await service.from("issues")
        .select("id,rule_id,metadata").eq("site_id",site.id).eq("status","open").limit(5000);
      if(priorIssuesError)throw new Error("Could not reconcile issue history: "+priorIssuesError.message);
      for(const previous of priorIssues||[]){
        const sourceUrl=typeof previous.metadata?.page_url==="string"?previous.metadata.page_url:"";
        const issueUrl=typeof previous.metadata?.url==="string"?previous.metadata.url:sourceUrl;
        if(sourceUrl&&scannedPageUrls.has(sourceUrl)&&!currentIssueKeys.has(previous.rule_id+"|"+issueUrl)){
          const {error:resolveError}=await service.from("issues").update({status:"resolved",updated_at:new Date().toISOString()}).eq("id",previous.id);
          if(resolveError)throw new Error("Could not resolve a finding that was not reproduced: "+resolveError.message);
        }
      }
    }

    const statusCounts={ok:crawled.filter(p=>p.status_code!==null&&p.status_code>=200&&p.status_code<400).length,errors:crawled.filter(p=>p.status_code!==null&&p.status_code>=400).length,failed:fetchFailures,robots_blocked:robotsBlocked};
    const issueCounts={critical:[...uniqueFindings.values()].filter(f=>f.severity==="critical").length,error:[...uniqueFindings.values()].filter(f=>f.severity==="error").length,warning:[...uniqueFindings.values()].filter(f=>f.severity==="warning").length,info:[...uniqueFindings.values()].filter(f=>f.severity==="info").length,opportunity:[...uniqueFindings.values()].filter(f=>f.severity==="opportunity").length,total:uniqueFindings.size};
    const budgetExhausted=queue.length>0&&crawled.length<maxPages;
    const finalStatus=fetchFailures>0||robotsBlocked>0||queue.length>0?"partial":"completed";
    const responseTimes=crawled.map(p=>Number(p.meta_snapshot?.response_time_ms||0)).filter(n=>n>0).sort((a,b)=>a-b);
    const averageResponseTime=responseTimes.length?Math.round(responseTimes.reduce((sum,n)=>sum+n,0)/responseTimes.length):null;
    const p75ResponseTime=responseTimes.length?responseTimes[Math.min(responseTimes.length-1,Math.ceil(responseTimes.length*0.75)-1)]:null;
    const summary={engine:"siteradar-crawl-mvp-0.3",pages_discovered:queued.size,pages_checked:crawled.filter(p=>p.fetch_state==="fetched").length,pages_recorded:crawled.length,performance:{samples:responseTimes.length,average_response_ms:averageResponseTime,p75_response_ms:p75ResponseTime,max_response_ms:responseTimes.length?responseTimes[responseTimes.length-1]:null},issues:issueCounts,fetch:statusCounts,robots_txt_checked:true,sitemaps_checked:sitemapUrls.size,sitemap_urls_discovered:discovered.size,js_rendering:false,budget_exhausted:budgetExhausted,limits:{pages_per_run:maxPages,wall_clock_budget_seconds:Math.round(CRAWL_BUDGET_MS/1000)},limitations:["Same-host only","Maximum 50 pages per request, subject to workspace edition limits and a 90-second safety budget","JavaScript rendering is not included","External link status checks are not performed","Robots rules use a conservative path-prefix parser","Sitemap indexes are followed to a bounded depth and file count","DNS is rechecked before each request; a dedicated worker with network-level egress restrictions remains a production hardening item"]};
    const {error:finishError}=await service.from("audit_runs").update({status:finalStatus,finished_at:new Date().toISOString(),summary}).eq("id",auditRunId);
    await service.from("audit_jobs").update({status:finalStatus,finished_at:new Date().toISOString(),heartbeat_at:new Date().toISOString(),error_code:null}).eq("id",auditJobId);
    if(finishError)throw new Error("Audit completed but summary could not be saved.");
    let emailStatus="not_configured";
    if(RESEND_API_KEY&&RESEND_FROM&&user.email){
      try{
        const emailRes=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+RESEND_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({from:RESEND_FROM,to:[user.email],subject:"Your VADX audit is complete",template:{id:AUDIT_TEMPLATE_ID,variables:{SITE_NAME:escapeHtml(site.name),PAGES_CHECKED:crawled.filter(p=>p.fetch_state==="fetched").length,ERROR_COUNT:issueCounts.critical+issueCounts.error+issueCounts.warning,WARNING_COUNT:issueCounts.warning,AUDIT_URL:(APP_URL||origin)+"/app/sites/"+site.id}}})});
        emailStatus=emailRes.ok?"sent":"failed";
      }catch{emailStatus="failed";}
    }
    return response({ok:true,audit_run_id:auditRunId,status:finalStatus,summary,email_status:emailStatus},200,origin);
  }catch(e){
    const message=e instanceof Error?e.message:"Audit failed.";
    if(service&&auditRunId){try{await service.from("audit_runs").update({status:"failed",finished_at:new Date().toISOString(),summary:{error:message}}).eq("id",auditRunId);}catch{}}
    if(service&&auditJobId){try{await service.from("audit_jobs").update({status:"failed",finished_at:new Date().toISOString(),error_code:"audit_failed"}).eq("id",auditJobId);}catch{}}
    return response({error:message,audit_run_id:auditRunId},500,origin);
  }
});
