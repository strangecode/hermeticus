import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeError,
  parseAllowedOrigins,
  parseCheckoutBody,
  safeHandleRequest,
  serializeCatalog,
} from "../src/index.js";

test("parseAllowedOrigins trims and de-duplicates origins", () => {
  const origins = parseAllowedOrigins(" https://hermeticus.org, http://127.0.0.1:4000, https://hermeticus.org ");
  assert.deepEqual([...origins], [
    "https://hermeticus.org",
    "http://127.0.0.1:4000",
  ]);
});

test("serializeCatalog drops zero-stock items and sorts by category then name", () => {
  const items = [
    { i: "1", v: "v1", n: "Book B", p: 1000, d: "", c: "Poetry", m: [] },
    { i: "2", v: "v2", n: "Book A", p: 1200, d: "", c: "Essays", m: [] },
    { i: "3", v: "v3", n: "Sold Out", p: 900, d: "", c: "Essays", m: [] },
  ];
  const inventory = new Map([
    ["v1", 1],
    ["v2", 2],
    ["v3", 0],
  ]);

  assert.deepEqual(serializeCatalog(items, inventory), [
    { i: "2", v: "v2", n: "Book A", p: 1200, d: "", c: "Essays", m: [], q: 2 },
    { i: "1", v: "v1", n: "Book B", p: 1000, d: "", c: "Poetry", m: [], q: 1 },
  ]);
});

test("parseCheckoutBody rejects duplicate variation ids", async () => {
  const request = new Request("https://worker.example/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [
        { v: "ABC", q: 1 },
        { v: "ABC", q: 1 },
      ],
    }),
  });

  await assert.rejects(parseCheckoutBody(request), /duplicated/i);
});

test("safeHandleRequest returns cached catalog with CORS headers", async () => {
  const cache = {
    async match() {
      return new Response(JSON.stringify([{ i: "1", v: "v1", n: "Cached", p: 1000, d: "", c: "", m: [], q: 1 }]), {
        headers: { "Content-Type": "application/json" },
      });
    },
    async put() {},
  };

  const request = new Request("https://worker.example/catalog", {
    headers: {
      Origin: "https://hermeticus.org",
    },
  });

  const response = await safeHandleRequest(
    request,
    {
      ALLOWED_ORIGINS: "https://hermeticus.org",
      SQUARE_ACCESS_TOKEN: "token",
      SQUARE_LOCATION_ID: "location",
    },
    { waitUntil() {} },
    { cache, fetchImpl: async () => assert.fail("fetch should not run on cache hit") },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://hermeticus.org");
  assert.deepEqual(await response.json(), [
    { i: "1", v: "v1", n: "Cached", p: 1000, d: "", c: "", m: [], q: 1 },
  ]);
});

test("normalizeError falls back to a generic 500", () => {
  assert.deepEqual(normalizeError(new Error("boom")), {
    status: 500,
    message: "boom",
  });
});
