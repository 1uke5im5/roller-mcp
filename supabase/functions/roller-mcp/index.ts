import { Hono } from "npm:hono@4";
import { cors } from "npm:hono/cors";

// ---------------------------------------------------------------------------
// MCP App resource URI
// ---------------------------------------------------------------------------
const APP_RESOURCE_URI = "ui://roller-mcp/products.html";
const MCP_ENDPOINT = "https://dtpvxwtcedeiqnpvrlxg.supabase.co/functions/v1/roller-mcp/mcp";

// ---------------------------------------------------------------------------
// Self-contained booking UI HTML (served as MCP App resource)
// ---------------------------------------------------------------------------
const APP_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>RollerBN Activities</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--brand:#ff4d00;--brand-dark:#cc3d00;--bg:#f5f5f7;--surface:#fff;--text:#1d1d1f;--muted:#6e6e73;--border:#d2d2d7;--radius:12px}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;padding:16px}
h1{font-size:1.4rem;font-weight:800;letter-spacing:-.03em;margin-bottom:4px}
.sub{font-size:.85rem;color:var(--muted);margin-bottom:20px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px}
.card{background:var(--surface);border-radius:var(--radius);box-shadow:0 2px 12px rgba(0,0,0,.07);overflow:hidden;display:flex;flex-direction:column;transition:transform .15s,box-shadow .15s}
.card:hover{transform:translateY(-2px);box-shadow:0 6px 24px rgba(0,0,0,.11)}
.card-img{width:100%;height:160px;object-fit:cover;background:var(--border);display:block}
.card-ph{width:100%;height:160px;background:linear-gradient(135deg,#ff4d0020,#ff8c6020);display:flex;align-items:center;justify-content:center;font-size:2.5rem}
.card-body{padding:14px;display:flex;flex-direction:column;gap:8px;flex:1}
.card-name{font-size:.95rem;font-weight:700;letter-spacing:-.02em;line-height:1.3}
.card-desc{font-size:.78rem;color:var(--muted);line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.card-meta{display:flex;gap:10px;font-size:.75rem;color:var(--muted);flex-wrap:wrap}
.price{font-size:1.05rem;font-weight:800;color:var(--brand)}
.price-from{font-size:.7rem;font-weight:400;color:var(--muted);margin-left:2px}
.tags{display:flex;flex-wrap:wrap;gap:4px}
.tag{background:#ff4d000f;color:#cc3d00;border-radius:20px;padding:2px 8px;font-size:.65rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em}
.btn{margin-top:auto;padding:10px;background:var(--brand);color:#fff;border:none;border-radius:8px;font-size:.85rem;font-weight:700;cursor:pointer;transition:background .15s}
.btn:hover{background:var(--brand-dark)}
@keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
.sk{background:linear-gradient(90deg,#e8e8eb 25%,#f0f0f3 50%,#e8e8eb 75%);background-size:800px 100%;animation:shimmer 1.4s infinite;border-radius:6px}
.sk-card{background:var(--surface);border-radius:var(--radius);overflow:hidden}
.sk-img{height:160px}.sk-body{padding:14px;display:flex;flex-direction:column;gap:8px}
.sk-h{height:18px;width:65%}.sk-p{height:12px;width:100%}.sk-p2{height:12px;width:80%}.sk-btn{height:36px;width:100%;margin-top:4px;border-radius:8px}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:100;padding:16px;opacity:0;pointer-events:none;transition:opacity .2s}
.modal-overlay.active{opacity:1;pointer-events:auto}
.modal{background:var(--surface);border-radius:16px;padding:24px;max-width:380px;width:100%;box-shadow:0 16px 48px rgba(0,0,0,.22);transform:translateY(12px) scale(.97);transition:transform .2s}
.modal-overlay.active .modal{transform:translateY(0) scale(1)}
.modal h2{font-size:1.2rem;font-weight:800;letter-spacing:-.02em;margin-bottom:4px}
.modal-pname{font-size:.82rem;color:var(--muted);margin-bottom:18px}
.modal label{display:block;font-size:.8rem;font-weight:600;margin-bottom:6px}
.modal input[type="date"]{width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:.95rem;color:var(--text);outline:none;font-family:inherit;margin-bottom:18px}
.modal input[type="date"]:focus{border-color:var(--brand)}
.modal-actions{display:flex;gap:8px}
.btn-cancel{flex:1;padding:10px;background:var(--bg);color:var(--text);border:none;border-radius:8px;font-size:.85rem;font-weight:600;cursor:pointer}
.btn-cancel:hover{background:var(--border)}
.btn-confirm{flex:2;padding:10px;background:var(--brand);color:#fff;border:none;border-radius:8px;font-size:.85rem;font-weight:700;cursor:pointer}
.btn-confirm:hover{background:var(--brand-dark)}
.btn-confirm:disabled{opacity:.4;cursor:not-allowed}
.err{background:#fff0ee;border:1px solid #ffd0c4;border-radius:var(--radius);padding:16px;color:#a3220a;text-align:center;font-size:.85rem}
</style>
</head>
<body>
<h1>RollerBN Activities</h1>
<p class="sub">Pick an experience and book your spot.</p>
<div id="grid" class="grid"></div>

<div class="modal-overlay" id="modal">
  <div class="modal">
    <h2>Choose a date</h2>
    <p class="modal-pname" id="mpname"></p>
    <label for="date-input">Select your preferred date</label>
    <input type="date" id="date-input"/>
    <div class="modal-actions">
      <button class="btn-cancel" id="btn-cancel">Cancel</button>
      <button class="btn-confirm" id="btn-confirm" disabled>Book Now &rarr;</button>
    </div>
  </div>
</div>

<script>
const MCP = "${MCP_ENDPOINT}";
const BOOKING_TYPES = new Set(["sessionpass","package","partypackage","pass","recurringpass"]);
const grid = document.getElementById("grid");
const modal = document.getElementById("modal");
const mpname = document.getElementById("mpname");
const dateInput = document.getElementById("date-input");
const btnConfirm = document.getElementById("btn-confirm");
const btnCancel = document.getElementById("btn-cancel");
let activeId = null, activeName = null;

function esc(s){return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
function fmtPrice(c){return c!=null?"$"+(c/100).toLocaleString("en-AU",{minimumFractionDigits:0,maximumFractionDigits:0})+" AUD":null}
function fmtDur(m){if(!m)return null;const h=Math.floor(m/60),mn=m%60;return h&&mn?h+"h "+mn+"m":h?h+"h":mn+"m"}
function lowestPrice(vs){const ps=(vs??[]).map(v=>v.price).filter(p=>p!=null);return ps.length?Math.min(...ps):null}

function skeletons(n=6){
  grid.innerHTML=Array.from({length:n}).map(()=>
    \`<div class="sk-card"><div class="sk sk-img"></div><div class="sk-body">
    <div class="sk sk-h"></div><div class="sk sk-p"></div><div class="sk sk-p2"></div>
    <div class="sk sk-btn"></div></div></div>\`).join("");
}

function renderCards(products){
  if(!products?.length){grid.innerHTML='<p style="color:var(--muted)">No activities found.</p>';return}
  grid.innerHTML=products.map(p=>{
    const price=lowestPrice(p.variations);
    const priceStr=fmtPrice(price);
    const dur=fmtDur(p.duration);
    const imgHtml=p.image_url
      ? \`<img class="card-img" src="\${esc(p.image_url)}" alt="\${esc(p.name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/><div class="card-ph" style="display:none">🎟</div>\`
      : \`<div class="card-ph">🎟</div>\`;
    const tagsHtml=(p.tags?.length)?\`<div class="tags">\${p.tags.map(t=>\`<span class="tag">\${esc(t)}</span>\`).join("")}</div>\`:"";
    return \`<article class="card">
      \${imgHtml}
      <div class="card-body">
        <h3 class="card-name">\${esc(p.name)}</h3>
        \${p.description?\`<p class="card-desc">\${esc(p.description.replace(/<[^>]+>/g," "))}</p>\`:""}
        <div class="card-meta">\${dur??""}  \${p.variations?.length?" · "+p.variations.length+" option"+(p.variations.length!==1?"s":""):""}</div>
        \${priceStr?\`<p class="price">\${esc(priceStr)}<span class="price-from"> from</span></p>\`:""}
        \${tagsHtml}
        <button class="btn" data-id="\${esc(p.id)}" data-name="\${esc(p.name)}">Book Now</button>
      </div>
    </article>\`;
  }).join("");
  grid.querySelectorAll(".btn").forEach(b=>b.addEventListener("click",()=>openModal(b.dataset.id,b.dataset.name)));
}

function openModal(id,name){
  activeId=id; activeName=name; mpname.textContent=name;
  const today=new Date().toISOString().split("T")[0];
  dateInput.value=today; dateInput.min=today; btnConfirm.disabled=false;
  modal.classList.add("active"); dateInput.focus();
}
function closeModal(){modal.classList.remove("active");activeId=null}
function confirm(){
  const date=dateInput.value; if(!date||!activeId)return;
  window.open(\`https://ecom.play.roller.app/rollerbn/rollercheckout/en/product/\${encodeURIComponent(activeId)}?date=\${encodeURIComponent(date)}\`,"_blank","noopener,noreferrer");
  closeModal();
}

btnCancel.addEventListener("click",closeModal);
btnConfirm.addEventListener("click",confirm);
dateInput.addEventListener("input",()=>{btnConfirm.disabled=!dateInput.value});
modal.addEventListener("click",e=>{if(e.target===modal)closeModal()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&modal.classList.contains("active"))closeModal()});

async function rpcCall(method,params={}){
  const res=await fetch(MCP,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params})});
  const d=await res.json();
  if(d.error)throw new Error(d.error.message);
  return d.result;
}

async function init(){
  skeletons(6);
  try{
    const result=await rpcCall("tools/call",{name:"get_products",arguments:{}});
    const all=JSON.parse(result.content[0].text);
    renderCards(all.filter(p=>BOOKING_TYPES.has(p.type)));
  }catch(e){
    grid.innerHTML=\`<div class="err"><strong>Could not load activities</strong><br/><small>\${esc(e.message)}</small></div>\`;
  }
}
init();
</script>
</body>
</html>`;

// ---------------------------------------------------------------------------
// OAuth2 token cache
// ---------------------------------------------------------------------------
interface TokenCache {
  token: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.token;
  }

  const clientId = Deno.env.get("ROLLER_CLIENT_ID");
  const clientSecret = Deno.env.get("ROLLER_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("ROLLER_CLIENT_ID and ROLLER_CLIENT_SECRET must be set");
  }

  const res = await fetch("https://api.play.roller.app/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    throw new Error(`OAuth token request failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };

  return tokenCache.token;
}

// ---------------------------------------------------------------------------
// Roller API helpers
// ---------------------------------------------------------------------------
function apiBase(): string {
  return Deno.env.get("ROLLER_API_BASE_URL") ?? "https://api.play.roller.app";
}

async function rollerFetch(path: string): Promise<unknown> {
  const token = await getAccessToken();
  const res = await fetch(`${apiBase()}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Roller API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Tool: get_products
// ---------------------------------------------------------------------------
interface Variation {
  id: string;
  name: string;
  price: number;
  tax: number;
  isTaxInclusive: boolean;
  groupSize: number | null;
  locations: string[];
  locationTimes: unknown[];
}

interface Product {
  id: string;
  name: string;
  type: string;
  description: string;
  image_url: string | null;
  duration: number | null;
  tags: string[];
  variations: Variation[];
}

// deno-lint-ignore no-explicit-any
async function toolGetProducts(): Promise<Product[]> {
  const data = await rollerFetch("/products") as any;
  const list: unknown[] = Array.isArray(data) ? data : (data?.products ?? []);

  return list.map((p: any): Product => ({
    id: p.id ?? p._id,
    name: p.name,
    type: p.type ?? "",
    description: p.description ?? "",
    image_url: p.imageUrl ?? p.image_url ?? null,
    duration: p.duration ?? null,
    tags: p.tags ?? [],
    variations: (p.variations ?? []).map((v: any): Variation => ({
      id: v.id ?? v._id,
      name: v.name,
      price: v.price ?? 0,
      tax: v.tax ?? 0,
      isTaxInclusive: v.isTaxInclusive ?? false,
      groupSize: v.groupSize ?? null,
      locations: v.locations ?? [],
      locationTimes: v.locationTimes ?? [],
    })),
  }));
}

// ---------------------------------------------------------------------------
// Tool: get_product_availability
// ---------------------------------------------------------------------------
async function toolGetProductAvailability(
  productId: string,
  date: string,
  endDate?: string,
): Promise<unknown> {
  const params = new URLSearchParams({ productId, date });
  if (endDate) params.set("endDate", endDate);
  return rollerFetch(`/product-availability?${params}`);
}

// ---------------------------------------------------------------------------
// MCP tool definitions
// ---------------------------------------------------------------------------
const TOOLS = [
  {
    name: "get_products",
    description:
      "Lists all bookable activities and experiences at RollerBN. Returns product details and renders an interactive booking UI in the conversation.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    _meta: {
      ui: {
        resourceUri: APP_RESOURCE_URI,
        csp: {
          connectDomains: ["dtpvxwtcedeiqnpvrlxg.supabase.co"],
          resourceDomains: [
            "*.play.roller.app",
            "*.cloudinary.com",
            "*.cloudfront.net",
            "*.amazonaws.com",
          ],
        },
      },
    },
  },
  {
    name: "get_product_availability",
    description:
      "Checks availability for a specific product on a given date range. Returns available time slots and capacity.",
    inputSchema: {
      type: "object",
      properties: {
        productId: {
          type: "string",
          description: "The Roller product ID to check availability for",
        },
        date: {
          type: "string",
          description: "Start date in YYYY-MM-DD format",
        },
        endDate: {
          type: "string",
          description: "Optional end date in YYYY-MM-DD format for a range query",
        },
      },
      required: ["productId", "date"],
    },
  },
];

// ---------------------------------------------------------------------------
// JSON-RPC helpers
// ---------------------------------------------------------------------------
// deno-lint-ignore no-explicit-any
function rpcResult(id: any, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

// deno-lint-ignore no-explicit-any
function rpcError(id: any, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

// ---------------------------------------------------------------------------
// MCP request dispatcher
// ---------------------------------------------------------------------------
// deno-lint-ignore no-explicit-any
async function dispatchMcp(msg: any): Promise<unknown | null> {
  const { jsonrpc, id, method, params } = msg;

  if (jsonrpc !== "2.0") {
    return rpcError(id ?? null, -32600, "Invalid JSON-RPC version");
  }

  switch (method) {
    // ------------------------------------------------------------------
    // Lifecycle
    // ------------------------------------------------------------------
    case "initialize":
      return rpcResult(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {}, resources: {} },
        serverInfo: { name: "roller-mcp", version: "1.0.0" },
      });

    case "initialized":
      return null;

    case "ping":
      return rpcResult(id, {});

    // ------------------------------------------------------------------
    // Resources (MCP Apps)
    // ------------------------------------------------------------------
    case "resources/list":
      return rpcResult(id, {
        resources: [{
          uri: APP_RESOURCE_URI,
          name: "RollerBN Activity Booking",
          mimeType: "text/html;profile=mcp-app",
          description: "Interactive product tile UI for browsing and booking RollerBN activities",
        }],
      });

    case "resources/read": {
      if (params?.uri !== APP_RESOURCE_URI) {
        return rpcError(id, -32602, `Unknown resource: ${params?.uri}`);
      }
      return rpcResult(id, {
        contents: [{
          uri: APP_RESOURCE_URI,
          mimeType: "text/html;profile=mcp-app",
          text: APP_HTML,
        }],
      });
    }

    // ------------------------------------------------------------------
    // Tools
    // ------------------------------------------------------------------
    case "tools/list":
      return rpcResult(id, { tools: TOOLS });

    case "tools/call": {
      const toolName: string = params?.name ?? "";
      const args = params?.arguments ?? {};

      try {
        let output: unknown;

        if (toolName === "get_products") {
          output = await toolGetProducts();

          // Return both JSON data and the MCP App resource
          return rpcResult(id, {
            content: [
              { type: "text", text: JSON.stringify(output, null, 2) },
              {
                type: "resource",
                resource: {
                  uri: APP_RESOURCE_URI,
                  mimeType: "text/html;profile=mcp-app",
                  text: APP_HTML,
                },
              },
            ],
          });
        } else if (toolName === "get_product_availability") {
          const { productId, date, endDate } = args;
          if (!productId || !date) {
            return rpcError(id, -32602, "productId and date are required");
          }
          output = await toolGetProductAvailability(productId, date, endDate);
        } else {
          return rpcError(id, -32601, `Unknown tool: ${toolName}`);
        }

        return rpcResult(id, {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return rpcError(id, -32603, message);
      }
    }

    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

// ---------------------------------------------------------------------------
// Streamable HTTP transport response builder
// ---------------------------------------------------------------------------
function sseResponse(payloads: unknown[]): Response {
  const body = payloads
    .map((p) => `data: ${JSON.stringify(p)}\n\n`)
    .join("");

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// ---------------------------------------------------------------------------
// Hono application
// ---------------------------------------------------------------------------
const app = new Hono();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
      "X-API-Key",
      "Mcp-Session-Id",
    ],
    exposeHeaders: ["Content-Type", "Mcp-Session-Id"],
    maxAge: 86400,
  }),
);

// Health / discovery endpoint
app.get("/roller-mcp/mcp", (c) =>
  c.json({
    name: "roller-mcp",
    version: "1.0.0",
    protocolVersion: "2024-11-05",
    description: "MCP server for the Roller booking platform",
    tools: TOOLS.map((t) => t.name),
  }),
);

// MCP Streamable HTTP endpoint
app.post("/roller-mcp/mcp", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(rpcError(null, -32700, "Parse error"), 400);
  }

  const wantsSSE = (c.req.header("Accept") ?? "").includes("text/event-stream");

  if (Array.isArray(body)) {
    const results = (
      await Promise.all((body as unknown[]).map(dispatchMcp))
    ).filter(Boolean);
    return wantsSSE ? sseResponse(results) : c.json(results);
  }

  const result = await dispatchMcp(body);

  if (result === null) {
    return new Response(null, { status: 202 });
  }

  return wantsSSE ? sseResponse([result]) : c.json(result);
});

Deno.serve(app.fetch);
