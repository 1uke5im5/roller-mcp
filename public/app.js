/**
 * RollerBN Booking UI — app.js
 *
 * Communicates with the roller-mcp Edge Function via JSON-RPC 2.0 (MCP).
 * Handles both plain JSON and text/event-stream (SSE) responses.
 */

// ---------------------------------------------------------------------------
// Configuration — update MCP_URL to your deployed Supabase Edge Function URL
// ---------------------------------------------------------------------------
const MCP_URL =
  (window.ROLLER_MCP_URL) ||
  "https://dtpvxwtcedeiqnpvrlxg.supabase.co/functions/v1/roller-mcp/mcp";

// ---------------------------------------------------------------------------
// JSON-RPC 2.0 over MCP Streamable HTTP
// ---------------------------------------------------------------------------
let _rpcId = 1;

/**
 * Send a single JSON-RPC request to the MCP server.
 * Accepts both application/json and text/event-stream responses.
 */
async function rpcCall(method, params = {}) {
  const id = _rpcId++;
  const body = JSON.stringify({ jsonrpc: "2.0", id, method, params });

  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }

  const contentType = res.headers.get("content-type") ?? "";

  // --- SSE response ---------------------------------------------------------
  if (contentType.includes("text/event-stream")) {
    return parseSSEResponse(res);
  }

  // --- Plain JSON response --------------------------------------------------
  const json = await res.json();

  if (json.error) {
    throw new Error(`RPC error ${json.error.code}: ${json.error.message}`);
  }

  return json.result;
}

/**
 * Parse an SSE stream and return the first meaningful result payload.
 */
async function parseSSEResponse(res) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result = undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop(); // keep incomplete line

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") break;

      try {
        const parsed = JSON.parse(data);
        if (parsed.result !== undefined) result = parsed.result;
        if (parsed.error) throw new Error(`RPC error ${parsed.error.code}: ${parsed.error.message}`);
      } catch (e) {
        if (e.message.startsWith("RPC error")) throw e;
        // ignore malformed lines
      }
    }
  }

  return result;
}

/**
 * Call a specific MCP tool by name with arguments.
 */
async function callTool(name, toolArgs = {}) {
  const result = await rpcCall("tools/call", { name, arguments: toolArgs });
  if (!result?.content?.length) throw new Error("Empty tool response");
  return JSON.parse(result.content[0].text);
}

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------
const grid = document.getElementById("products-grid");
const modal = document.getElementById("booking-modal");
const modalProductName = document.getElementById("modal-product-name");
const dateInput = document.getElementById("date-input");
const confirmBtn = document.getElementById("modal-confirm");
const cancelBtn = document.getElementById("modal-cancel");

let activeProductId = null;

/** Format cents → $X.XX */
function formatPrice(cents) {
  if (cents == null) return null;
  return (cents / 100).toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
  });
}

/** Return the lowest variation price (in cents) or null */
function lowestPrice(variations) {
  if (!variations?.length) return null;
  const prices = variations.map((v) => v.price).filter((p) => p != null);
  return prices.length ? Math.min(...prices) : null;
}

/** Format duration in minutes → "1 h 30 min" etc. */
function formatDuration(minutes) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h} h ${m} min`;
  if (h) return `${h} h`;
  return `${m} min`;
}

// Skeleton placeholders
function renderSkeletons(count = 6) {
  grid.innerHTML = Array.from({ length: count })
    .map(
      () => `
    <div class="card-skeleton" aria-hidden="true">
      <div class="skeleton sk-img"></div>
      <div class="sk-body">
        <div class="skeleton sk-h"></div>
        <div class="skeleton sk-p"></div>
        <div class="skeleton sk-p2"></div>
        <div class="skeleton sk-btn"></div>
      </div>
    </div>`
    )
    .join("");
}

function renderProducts(products) {
  grid.setAttribute("aria-busy", "false");

  if (!products?.length) {
    grid.innerHTML = `<p style="color:var(--muted)">No products found.</p>`;
    return;
  }

  grid.innerHTML = products
    .map((p) => {
      const price = lowestPrice(p.variations);
      const priceStr = price != null ? formatPrice(price) : null;
      const durationStr = formatDuration(p.duration);
      const varCount = p.variations?.length ?? 0;

      const imageHtml = p.image_url
        ? `<img class="card-img" src="${escHtml(p.image_url)}" alt="${escHtml(p.name)}" loading="lazy" />`
        : `<div class="card-img-placeholder" aria-hidden="true">🎟️</div>`;

      const tagsHtml = p.tags?.length
        ? `<div class="tags">${p.tags.map((t) => `<span class="tag">${escHtml(t)}</span>`).join("")}</div>`
        : "";

      const metaParts = [];
      if (durationStr)
        metaParts.push(`
        <span class="card-meta-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>${escHtml(durationStr)}
        </span>`);
      if (varCount)
        metaParts.push(`
        <span class="card-meta-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
          </svg>${varCount} option${varCount !== 1 ? "s" : ""}
        </span>`);

      return `
      <article class="card">
        ${imageHtml}
        <div class="card-body">
          <h3 class="card-name">${escHtml(p.name)}</h3>
          ${p.description ? `<p class="card-description">${escHtml(p.description.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim())}</p>` : ""}
          ${metaParts.length ? `<div class="card-meta">${metaParts.join("")}</div>` : ""}
          ${priceStr ? `<p class="price">${escHtml(priceStr)}<span class="price-from">from</span></p>` : ""}
          ${tagsHtml}
          <button class="btn-book" data-id="${escHtml(p.id)}" data-name="${escHtml(p.name)}">
            Book Now
          </button>
        </div>
      </article>`;
    })
    .join("");

  // Attach "Book Now" listeners
  grid.querySelectorAll(".btn-book").forEach((btn) => {
    btn.addEventListener("click", () => openBookingModal(btn.dataset.id, btn.dataset.name));
  });
}

function renderError(message) {
  grid.setAttribute("aria-busy", "false");
  grid.innerHTML = `
    <div class="error-box">
      <strong>Could not load products</strong><br/>
      <small>${escHtml(message)}</small>
    </div>`;
}

// ---------------------------------------------------------------------------
// Booking modal
// ---------------------------------------------------------------------------
function openBookingModal(productId, productName) {
  activeProductId = productId;
  modalProductName.textContent = productName;

  // Default date to today
  const today = new Date().toISOString().split("T")[0];
  dateInput.value = today;
  dateInput.min = today;
  confirmBtn.disabled = false;

  modal.classList.add("active");
  dateInput.focus();
}

function closeModal() {
  modal.classList.remove("active");
  activeProductId = null;
}

function handleConfirm() {
  const date = dateInput.value;
  if (!date || !activeProductId) return;

  const checkoutUrl = `https://ecom.play.roller.app/rollerbn/rollercheckout/en/product/${encodeURIComponent(activeProductId)}?date=${encodeURIComponent(date)}`;
  window.open(checkoutUrl, "_blank", "noopener,noreferrer");
  closeModal();
}

// Modal controls
cancelBtn.addEventListener("click", closeModal);
confirmBtn.addEventListener("click", handleConfirm);
dateInput.addEventListener("input", () => {
  confirmBtn.disabled = !dateInput.value;
});

// Close on overlay click
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});

// Close on Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modal.classList.contains("active")) closeModal();
});

// ---------------------------------------------------------------------------
// Security: HTML escape
// ---------------------------------------------------------------------------
function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
async function init() {
  // First, initialise the MCP session
  try {
    await rpcCall("initialize", {
      protocolVersion: "2024-11-05",
      clientInfo: { name: "roller-booking-ui", version: "1.0.0" },
      capabilities: {},
    });
    // Send initialized notification (fire and forget — 202 response expected)
    fetch(MCP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "initialized" }),
    }).catch(() => {});
  } catch (e) {
    console.warn("MCP initialize failed (non-fatal):", e.message);
  }

  renderSkeletons(6);

  try {
    const BOOKING_TYPES = new Set([
      "sessionpass", "package", "partypackage", "pass", "recurringpass",
    ]);
    const all = await callTool("get_products");
    const products = all.filter((p) => BOOKING_TYPES.has(p.type));
    renderProducts(products);
  } catch (err) {
    renderError(err.message);
  }
}

init();
