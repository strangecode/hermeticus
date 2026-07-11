import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateShipping,
  normalizeError,
  parseAllowedOrigins,
  parseCheckoutBody,
  safeHandleRequest,
  serializeCatalog,
  validateShippingConfig,
} from "../src/index.js";
import shippingRates from "../shipping-rates.json" with { type: "json" };

test("parseAllowedOrigins trims and de-duplicates origins", () => {
  const origins = parseAllowedOrigins(" https://hermeticus.org, http://127.0.0.1:4000, https://hermeticus.org ");
  assert.deepEqual([...origins], [
    "https://hermeticus.org",
    "http://127.0.0.1:4000",
  ]);
});

test("serializeCatalog drops zero-stock items and sorts by category then name", () => {
  const items = [
    { i: "1", v: "v1", n: "Book B", p: 1000, d: "", c: "Poetry", m: [], w: null },
    { i: "2", v: "v2", n: "Book A", p: 1200, d: "", c: "Essays", m: [], w: 2 },
    { i: "3", v: "v3", n: "Sold Out", p: 900, d: "", c: "Essays", m: [], w: null },
  ];
  const inventory = new Map([
    ["v1", 1],
    ["v2", 2],
    ["v3", 0],
  ]);

  assert.deepEqual(serializeCatalog(items, inventory), [
    { i: "2", v: "v2", n: "Book A", p: 1200, d: "", c: "Essays", m: [], w: 2, q: 2 },
    { i: "1", v: "v1", n: "Book B", p: 1000, d: "", c: "Poetry", m: [], w: null, q: 1 },
  ]);
});

test("safeHandleRequest returns Square description HTML in the description field", async () => {
  const requests = [];
  const fetchImpl = async (url) => {
    requests.push(url);
    if (url.includes("/v2/catalog/list")) {
      return new Response(JSON.stringify({
        objects: [
          {
            id: "category-1",
            type: "CATEGORY",
            category_data: { name: "Postcards" },
          },
          {
            id: "weight-definition",
            type: "CUSTOM_ATTRIBUTE_DEFINITION",
            custom_attribute_definition_data: {
              name: "Shipping weight (lb)",
            },
          },
          {
            id: "item-1",
            type: "ITEM",
            item_data: {
              name: "Watercolor Postcard",
              category_id: "category-1",
              description_html:
                '<p>Painting by <a rel="noopener noreferrer nofollow" href="https://ayon.me/">Alma Ayon.</a></p>',
              description_plaintext: "Painting by Alma Ayon.",
              variations: [
                {
                  id: "variation-1",
                  custom_attribute_values: {
                    dashboard_key: {
                      custom_attribute_definition_id: "weight-definition",
                      type: "NUMBER",
                      number_value: "0.1",
                    },
                  },
                  item_variation_data: {
                    price_money: { amount: 500 },
                    sellable: true,
                  },
                },
              ],
            },
          },
        ],
      }));
    }

    if (url.includes("/v2/inventory/counts/batch-retrieve")) {
      return new Response(JSON.stringify({
        counts: [
          {
            catalog_object_id: "variation-1",
            quantity: "3",
          },
        ],
      }));
    }

    assert.fail(`Unexpected Square request: ${url}`);
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
    { fetchImpl },
  );

  assert.equal(response.status, 200);
  assert.equal(requests.length, 2);
  assert.deepEqual(await response.json(), [
    {
      i: "item-1",
      v: "variation-1",
      n: "Watercolor Postcard",
      p: 500,
      d: '<p>Painting by <a rel="noopener noreferrer nofollow" href="https://ayon.me/">Alma Ayon.</a></p>',
      c: "Postcards",
      m: [],
      w: 0.1,
      q: 3,
    },
  ]);
});

test("catalog weight prefers the variation attribute and safely normalizes invalid values", async () => {
  const fetchImpl = async (url) => {
    if (url.includes("/v2/catalog/list")) {
      return new Response(JSON.stringify({
        objects: [
          {
            id: "weight-definition",
            type: "CUSTOM_ATTRIBUTE_DEFINITION",
            custom_attribute_definition_data: { name: "Shipping weight (lb)" },
          },
          ...[
            ["variation-weight", "4", "2"],
            ["item-weight", null, "3.5"],
            ["invalid-weight", "-1", "2"],
            ["missing-weight", null, null],
          ].map(([id, variationWeight, itemWeight]) => ({
            id: `item-${id}`,
            type: "ITEM",
            ...(itemWeight === null ? {} : {
              custom_attribute_values: {
                item_weight: weightAttribute("weight-definition", itemWeight),
              },
            }),
            item_data: {
              name: id,
              variations: [{
                id,
                ...(variationWeight === null ? {} : {
                  custom_attribute_values: {
                    variation_weight: weightAttribute("weight-definition", variationWeight),
                  },
                }),
                item_variation_data: {
                  price_money: { amount: 1000 },
                  sellable: true,
                },
              }],
            },
          })),
        ],
      }));
    }

    if (url.includes("/v2/inventory/counts/batch-retrieve")) {
      return new Response(JSON.stringify({
        counts: ["variation-weight", "item-weight", "invalid-weight", "missing-weight"]
          .map((id) => ({ catalog_object_id: id, quantity: "1" })),
      }));
    }

    assert.fail(`Unexpected Square request: ${url}`);
  };

  const response = await safeHandleRequest(
    new Request("https://worker.example/catalog"),
    workerEnv(),
    { waitUntil() {} },
    { fetchImpl },
  );
  const catalog = await response.json();
  const weights = new Map(catalog.map((item) => [item.v, item.w]));

  assert.equal(weights.get("variation-weight"), 4);
  assert.equal(weights.get("item-weight"), 3.5);
  assert.equal(weights.get("invalid-weight"), null);
  assert.equal(weights.get("missing-weight"), null);
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

test("shipping configuration validates every required setting", () => {
  const invalidConfigurations = [
    null,
    { ...shippingRates, currency: "CAD" },
    { ...shippingRates, weightAttributeName: "" },
    { ...shippingRates, freeItemMaximumPounds: -1 },
    { ...shippingRates, weightRateCentsPerPound: 0 },
    { ...shippingRates, freeShippingBelowCents: -1 },
    { ...shippingRates, minimumShippingCents: 99 },
    { ...shippingRates, perItemRatesCents: { ...shippingRates.perItemRatesCents, "12": -1 } },
    { ...shippingRates, perItemRatesCents: { ...shippingRates.perItemRatesCents, "25+": undefined } },
  ];

  assert.doesNotThrow(() => validateShippingConfig(shippingRates));
  for (const configuration of invalidConfigurations) {
    assert.throws(() => validateShippingConfig(configuration), /shipping configuration/i);
  }
});

test("per-item shipping covers every configured quantity boundary", () => {
  for (let quantity = 1; quantity <= 24; quantity += 1) {
    assert.equal(calculateShipping([{ q: quantity, w: null }]), 400 + quantity * 100);
  }
  assert.equal(calculateShipping([{ q: 25, w: null }]), 3000);
  assert.equal(calculateShipping([{ q: 50, w: null }]), 3000);
});

test("weight shipping applies free and minimum thresholds after rounding up", () => {
  assert.equal(calculateShipping([{ q: 1, w: 0.1 }]), 0);
  assert.equal(calculateShipping([{ q: 1, w: 0.11 }]), 0);
  assert.equal(calculateShipping([{ q: 1, w: 0.5 }]), 500);
  assert.equal(calculateShipping([{ q: 1, w: 2.5 }]), 500);
  assert.equal(calculateShipping([{ q: 1, w: 2.5001 }]), 501);
  assert.equal(calculateShipping([{ q: 3, w: 1 }]), 600);
});

test("mixed shipping uses the higher qualifying candidate and excludes free items", () => {
  assert.equal(calculateShipping([
    { q: 1, w: null },
    { q: 1, w: 5 },
    { q: 1, w: 0.1 },
  ]), 1000);

  assert.equal(calculateShipping([
    { q: 2, w: null },
    { q: 1, w: 0.5 },
    { q: 10, w: 0.1 },
  ]), 700);

  assert.equal(calculateShipping([
    { q: 2, w: null },
    { q: 10, w: 0.1 },
  ]), 600);
});

test("shipping calculation fails closed when a configured weight exceeds safe money math", () => {
  assert.throws(
    () => calculateShipping([{ q: 2, w: Number.MAX_SAFE_INTEGER }]),
    /exceeds the supported amount/i,
  );
});

test("checkout charges calculated shipping and asks for a shipping address", async () => {
  const paymentLinkBodies = [];
  const fetchImpl = async (url, init) => {
    if (url.includes("/v2/catalog/list")) {
      return new Response(JSON.stringify({
        objects: [
          {
            id: "weight-definition",
            type: "CUSTOM_ATTRIBUTE_DEFINITION",
            custom_attribute_definition_data: { name: "Shipping weight (lb)" },
          },
          {
            id: "item-1",
            type: "ITEM",
            item_data: {
              name: "A Field Guide to the Aether",
              variations: [
                {
                  id: "variation-1",
                  custom_attribute_values: {
                    shipping_weight: weightAttribute("weight-definition", "5"),
                  },
                  item_variation_data: {
                    price_money: { amount: 2000 },
                    sellable: true,
                  },
                },
              ],
            },
          },
        ],
      }));
    }

    if (url.includes("/v2/inventory/counts/batch-retrieve")) {
      return new Response(JSON.stringify({
        counts: [{ catalog_object_id: "variation-1", quantity: "5" }],
      }));
    }

    if (url.includes("/v2/online-checkout/payment-links")) {
      paymentLinkBodies.push(JSON.parse(init.body));
      return new Response(JSON.stringify({
        payment_link: { url: "https://square.link/u/checkout" },
      }));
    }

    assert.fail(`Unexpected Square request: ${url}`);
  };

  const request = new Request("https://worker.example/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://hermeticus.org",
    },
    body: JSON.stringify({ items: [{ v: "variation-1", q: 1 }] }),
  });

  const response = await safeHandleRequest(
    request,
      workerEnv(),
    { waitUntil() {} },
    { fetchImpl },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { u: "https://square.link/u/checkout" });

  assert.equal(paymentLinkBodies.length, 1);
  const { checkout_options: checkoutOptions } = paymentLinkBodies[0];
  assert.equal(checkoutOptions.ask_for_shipping_address, true);
  assert.equal("custom_fields" in checkoutOptions, false);
  assert.deepEqual(checkoutOptions.shipping_fee, {
    name: "Shipping",
    charge: {
      amount: 1000,
      currency: "USD",
    },
  });
});

test("checkout labels a free-shipping order without a confirmation field", async () => {
  const paymentLinkBodies = [];
  const fetchImpl = squareCheckoutFetch({ weight: "0.1", paymentLinkBodies });
  const request = new Request("https://worker.example/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://hermeticus.org" },
    body: JSON.stringify({ items: [{ v: "variation-1", q: 4 }] }),
  });

  const response = await safeHandleRequest(
    request,
    workerEnv(),
    { waitUntil() {} },
    { fetchImpl },
  );

  assert.equal(response.status, 200);
  const checkoutOptions = paymentLinkBodies[0].checkout_options;
  assert.equal("custom_fields" in checkoutOptions, false);
  assert.deepEqual(checkoutOptions.shipping_fee, {
    name: "Free shipping",
    charge: { amount: 0, currency: "USD" },
  });
});

test("safeHandleRequest returns cached catalog with CORS headers", async () => {
  const cache = {
    async match() {
      return new Response(JSON.stringify([{ i: "1", v: "v1", n: "Cached", p: 1000, d: "", c: "", m: [], w: null, q: 1 }]), {
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
    { i: "1", v: "v1", n: "Cached", p: 1000, d: "", c: "", m: [], w: null, q: 1 },
  ]);
});

function weightAttribute(definitionId, value) {
  return {
    custom_attribute_definition_id: definitionId,
    type: "NUMBER",
    number_value: value,
  };
}

function workerEnv() {
  return {
    ALLOWED_ORIGINS: "https://hermeticus.org",
    SQUARE_ACCESS_TOKEN: "token",
    SQUARE_LOCATION_ID: "location",
  };
}

function squareCheckoutFetch({ weight, paymentLinkBodies }) {
  return async (url, init) => {
    if (url.includes("/v2/catalog/list")) {
      return new Response(JSON.stringify({
        objects: [
          {
            id: "weight-definition",
            type: "CUSTOM_ATTRIBUTE_DEFINITION",
            custom_attribute_definition_data: { name: "Shipping weight (lb)" },
          },
          {
            id: "item-1",
            type: "ITEM",
            item_data: {
              name: "Postcard",
              variations: [{
                id: "variation-1",
                custom_attribute_values: {
                  shipping_weight: weightAttribute("weight-definition", weight),
                },
                item_variation_data: {
                  price_money: { amount: 500 },
                  sellable: true,
                },
              }],
            },
          },
        ],
      }));
    }
    if (url.includes("/v2/inventory/counts/batch-retrieve")) {
      return new Response(JSON.stringify({
        counts: [{ catalog_object_id: "variation-1", quantity: "20" }],
      }));
    }
    if (url.includes("/v2/online-checkout/payment-links")) {
      paymentLinkBodies.push(JSON.parse(init.body));
      return new Response(JSON.stringify({
        payment_link: { url: "https://square.link/u/checkout" },
      }));
    }
    assert.fail(`Unexpected Square request: ${url}`);
  };
}

test("normalizeError falls back to a generic 500", () => {
  assert.deepEqual(normalizeError(new Error("boom")), {
    status: 500,
    message: "boom",
  });
});
