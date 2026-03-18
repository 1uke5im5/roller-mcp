import { Hono } from "npm:hono@4";
import { cors } from "npm:hono/cors";

// ---------------------------------------------------------------------------
// OAuth2 token cache
// ---------------------------------------------------------------------------
interface TokenCache {
  token: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

async function getAccessToken(): Promise<string> {
  // Serve from cache if valid for at least another 60 s
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
// MCP tool definitions (JSON Schema)
// ---------------------------------------------------------------------------
const TOOLS = [
  {
    name: "get_products",
    description:
      "Lists all bookable products from the Roller platform. Returns id, name, type, description, image_url, duration (minutes), tags, and variations (with price in cents, tax, groupSize, locations).",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
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
        capabilities: { tools: {} },
        serverInfo: { name: "roller-mcp", version: "1.0.0" },
      });

    case "initialized":
      return null; // notification — no response

    case "ping":
      return rpcResult(id, {});

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

  // Batch request
  if (Array.isArray(body)) {
    const results = (
      await Promise.all((body as unknown[]).map(dispatchMcp))
    ).filter(Boolean);

    return wantsSSE ? sseResponse(results) : c.json(results);
  }

  // Single request
  const result = await dispatchMcp(body);

  if (result === null) {
    // Notification — 202 Accepted, no body
    return new Response(null, { status: 202 });
  }

  return wantsSSE ? sseResponse([result]) : c.json(result);
});

Deno.serve(app.fetch);
