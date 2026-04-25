const DEFAULT_TTL_SECONDS = 300;
const DEFAULT_SQUARE_VERSION = "2026-01-22";
const SQUARE_TYPES = "ITEM,CATEGORY,IMAGE";
const MAX_CART_LINES = 50;
const MAX_INVENTORY_BATCH = 1000;

export default {
  async fetch(request, env, ctx) {
    return safeHandleRequest(request, env, ctx, {
      cache: globalThis.caches?.default,
      fetchImpl: globalThis.fetch,
    });
  },
};

export async function handleRequest(request, env, ctx, runtime = {}) {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  const allowedOrigin = getAllowedOrigin(origin, env);

  if (origin && !allowedOrigin) {
    return jsonError(403, "Origin not allowed.");
  }

  if (request.method === "OPTIONS") {
    return withCors(
      new Response(null, {
        status: 204,
        headers: preflightHeaders(),
      }),
      allowedOrigin,
    );
  }

  if (url.pathname === "/catalog" && request.method === "GET") {
    return handleCatalogRequest(request, env, ctx, runtime, allowedOrigin);
  }

  if (url.pathname === "/checkout" && request.method === "POST") {
    return handleCheckoutRequest(request, env, runtime, allowedOrigin);
  }

  return withCors(jsonError(404, "Not found."), allowedOrigin);
}

async function handleCatalogRequest(request, env, ctx, runtime, allowedOrigin) {
  const cache = runtime.cache;
  const cacheKey = buildCacheKey(request);

  if (cache) {
    const cached = await cache.match(cacheKey);
    if (cached) {
      return withCors(cached, allowedOrigin);
    }
  }

  const catalog = await loadPublicCatalog(env, runtime.fetchImpl);
  const response = jsonResponse(catalog, {
    headers: {
      "Cache-Control": buildCacheControl(env),
      "Content-Type": "application/json; charset=utf-8",
    },
  });

  if (cache && response.ok && ctx?.waitUntil) {
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
  }

  return withCors(response, allowedOrigin);
}

async function handleCheckoutRequest(request, env, runtime, allowedOrigin) {
  const cart = await parseCheckoutBody(request);
  const liveCatalog = await loadPublicCatalog(env, runtime.fetchImpl);
  const itemByVariationId = new Map(liveCatalog.map((item) => [item.v, item]));
  const lineItems = cart.items.map((item) => validateCartLine(item, itemByVariationId));

  const paymentLink = await createPaymentLink(lineItems, env, runtime.fetchImpl);
  return withCors(jsonResponse({ u: paymentLink }), allowedOrigin);
}

async function loadPublicCatalog(env, fetchImpl) {
  assertWorkerEnv(env);

  const objects = await listCatalogObjects(env, fetchImpl);
  const catalogItems = objects.filter((object) => object.type === "ITEM");
  const categories = buildObjectMap(objects, "CATEGORY", "category_data");
  const images = buildObjectMap(objects, "IMAGE", "image_data");
  const candidateItems = catalogItems
    .map((item) => extractCatalogCandidate(item, categories, images))
    .filter(Boolean);

  const inventory = await fetchInventoryCounts(
    candidateItems.map((item) => item.v),
    env,
    fetchImpl,
  );

  return serializeCatalog(candidateItems, inventory);
}

async function listCatalogObjects(env, fetchImpl) {
  const objects = [];
  let cursor = null;

  do {
    const url = new URL("/v2/catalog/list", getSquareBaseUrl(env));
    url.searchParams.set("types", SQUARE_TYPES);
    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }

    const payload = await squareJson(url, { method: "GET" }, env, fetchImpl);
    objects.push(...(payload.objects || []));
    cursor = payload.cursor || null;
  } while (cursor);

  return objects;
}

async function fetchInventoryCounts(variationIds, env, fetchImpl) {
  const inventory = new Map();

  for (const chunk of chunkArray(variationIds, MAX_INVENTORY_BATCH)) {
    let cursor = null;

    do {
      const url = new URL("/v2/inventory/counts/batch-retrieve", getSquareBaseUrl(env));
      const body = {
        catalog_object_ids: chunk,
        location_ids: [env.SQUARE_LOCATION_ID],
        states: ["IN_STOCK"],
      };

      if (cursor) {
        body.cursor = cursor;
      }

      const payload = await squareJson(
        url,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
        env,
        fetchImpl,
      );

      for (const count of payload.counts || []) {
        const variationId = count.catalog_object_id;
        const quantity = normalizeQuantity(count.quantity);
        inventory.set(variationId, Math.max(quantity, inventory.get(variationId) || 0));
      }

      cursor = payload.cursor || null;
    } while (cursor);
  }

  return inventory;
}

async function createPaymentLink(lineItems, env, fetchImpl) {
  const url = new URL("/v2/online-checkout/payment-links", getSquareBaseUrl(env));
  const payload = await squareJson(
    url,
    {
      method: "POST",
      body: JSON.stringify({
        idempotency_key: crypto.randomUUID(),
        order: {
          location_id: env.SQUARE_LOCATION_ID,
          line_items: lineItems.map((item) => ({
            catalog_object_id: item.v,
            quantity: String(item.q),
          })),
        },
        checkout_options: {
          redirect_url: `${getPrimaryOrigin(env)}/books/?checkout=success`,
        },
      }),
    },
    env,
    fetchImpl,
  );

  const paymentLink = payload.payment_link?.url || payload.payment_link?.long_url || null;
  if (!paymentLink) {
    throw createHttpError(502, "Square did not return a checkout URL.");
  }

  return paymentLink;
}

function extractCatalogCandidate(object, categories, images) {
  const item = object.item_data || {};
  const variations = item.variations || [];

  if (item.is_archived || variations.length !== 1) {
    return null;
  }

  const variation = variations[0];
  const variationData = variation.item_variation_data || {};
  const price = variationData.price_money?.amount;
  const variationId = variation.id;

  if (!variationId || !Number.isInteger(price) || price <= 0 || variationData.sellable === false) {
    return null;
  }

  const categoryId =
    item.category_id ||
    item.reporting_category?.id ||
    item.categories?.[0]?.id ||
    "";
  const categoryName = categories.get(categoryId)?.name || "";
  const description =
    item.description_html ||
    item.description_plaintext ||
    item.description ||
    "";
  const imageIds = uniqueValues([
    ...(item.image_ids || []),
    ...(variationData.image_ids || []),
  ]);
  const imageUrls = imageIds
    .map((imageId) => images.get(imageId)?.url)
    .filter(Boolean);

  return {
    i: object.id,
    v: variationId,
    n: item.name || "",
    p: price,
    d: description,
    c: categoryName,
    m: imageUrls,
  };
}

export function serializeCatalog(items, inventory) {
  return items
    .map((item) => ({
      ...item,
      q: inventory.get(item.v) || 0,
    }))
    .filter((item) => item.n && item.q > 0)
    .sort((left, right) => {
      const categoryCompare = left.c.localeCompare(right.c);
      if (categoryCompare !== 0) {
        return categoryCompare;
      }
      return left.n.localeCompare(right.n);
    });
}

function validateCartLine(item, itemByVariationId) {
  const catalogItem = itemByVariationId.get(item.v);
  if (!catalogItem) {
    throw createHttpError(400, `Book ${item.v} is no longer available.`);
  }

  if (item.q > catalogItem.q) {
    throw createHttpError(409, `${catalogItem.n} no longer has enough stock.`);
  }

  return item;
}

export async function parseCheckoutBody(request) {
  let body;
  try {
    body = await request.json();
  } catch (error) {
    throw createHttpError(400, "Checkout body must be valid JSON.");
  }

  if (!body || !Array.isArray(body.items) || body.items.length === 0) {
    throw createHttpError(400, "Checkout requires at least one cart line.");
  }

  if (body.items.length > MAX_CART_LINES) {
    throw createHttpError(400, "Checkout exceeds the maximum line count.");
  }

  const seen = new Set();
  const items = body.items.map((item) => {
    if (!item || typeof item.v !== "string" || !item.v.trim()) {
      throw createHttpError(400, "Each cart line needs a variation id.");
    }

    const quantity = Number(item.q);
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw createHttpError(400, `Cart line ${item.v} has an invalid quantity.`);
    }

    if (seen.has(item.v)) {
      throw createHttpError(400, `Cart line ${item.v} is duplicated.`);
    }

    seen.add(item.v);
    return { v: item.v, q: quantity };
  });

  return { items };
}

function buildObjectMap(objects, type, key) {
  return new Map(
    objects
      .filter((object) => object.type === type)
      .map((object) => [object.id, object[key] || {}]),
  );
}

function buildCacheKey(request) {
  const url = new URL(request.url);
  url.search = "";
  return new Request(url.toString(), { method: "GET" });
}

function buildCacheControl(env) {
  const ttl = getTtlSeconds(env);
  return `public, max-age=60, s-maxage=${ttl}, stale-while-revalidate=${ttl * 12}`;
}

function getSquareBaseUrl(env) {
  return env.SQUARE_ENV === "sandbox"
    ? "https://connect.squareupsandbox.com"
    : "https://connect.squareup.com";
}

function getSquareHeaders(env) {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${env.SQUARE_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
    "Square-Version": env.SQUARE_VERSION || DEFAULT_SQUARE_VERSION,
  };
}

function getAllowedOrigin(origin, env) {
  if (!origin) {
    return null;
  }

  return parseAllowedOrigins(env.ALLOWED_ORIGINS).has(origin) ? origin : null;
}

function getPrimaryOrigin(env) {
  return parseAllowedOrigins(env.ALLOWED_ORIGINS).values().next().value || "https://hermeticus.org";
}

export function parseAllowedOrigins(value) {
  return new Set(
    String(value || "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

function getTtlSeconds(env) {
  const ttl = Number(env.CATALOG_TTL_SECONDS);
  return Number.isInteger(ttl) && ttl > 0 ? ttl : DEFAULT_TTL_SECONDS;
}

async function squareJson(url, init, env, fetchImpl) {
  const response = await fetchImpl(url.toString(), {
    ...init,
    headers: {
      ...getSquareHeaders(env),
      ...(init.headers || {}),
    },
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    throw createHttpError(502, `Square returned invalid JSON for ${url.pathname}.`);
  }

  if (!response.ok) {
    const detail = payload?.errors?.[0]?.detail || `Square request failed for ${url.pathname}.`;
    throw createHttpError(502, detail);
  }

  return payload;
}

function normalizeQuantity(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return 0;
  }
  return Math.floor(number);
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function chunkArray(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function assertWorkerEnv(env) {
  for (const key of ["ALLOWED_ORIGINS", "SQUARE_ACCESS_TOKEN", "SQUARE_LOCATION_ID"]) {
    if (!env[key]) {
      throw createHttpError(500, `Worker configuration is missing ${key}.`);
    }
  }
}

function withCors(response, allowedOrigin) {
  const headers = new Headers(response.headers);
  headers.set("Vary", mergeVary(headers.get("Vary"), "Origin"));

  if (allowedOrigin) {
    headers.set("Access-Control-Allow-Origin", allowedOrigin);
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
  }

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

function preflightHeaders() {
  return {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function mergeVary(current, value) {
  const values = new Set(String(current || "").split(",").map((part) => part.trim()).filter(Boolean));
  values.add(value);
  return [...values].join(", ");
}

function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(init.headers || {}),
    },
  });
}

function jsonError(status, message) {
  return jsonResponse({ error: message }, { status });
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function normalizeError(error) {
  return {
    status: Number(error?.status) || 500,
    message: error?.message || "Unexpected worker error.",
  };
}

if (typeof addEventListener === "function") {
  addEventListener("unhandledrejection", (event) => {
    event.preventDefault();
  });

  addEventListener("error", (event) => {
    event.preventDefault();
  });
}

export async function safeHandleRequest(request, env, ctx, runtime = {}) {
  try {
    return await handleRequest(request, env, ctx, runtime);
  } catch (error) {
    const normalized = normalizeError(error);
    const origin = request.headers.get("Origin");
    const allowedOrigin = getAllowedOrigin(origin, env);
    return withCors(jsonError(normalized.status, normalized.message), allowedOrigin);
  }
}
