// Tests for junglescout-mcp tool handlers
// All upstream HTTP is mocked; no live network calls are made.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { JsClient } from "../src/client.js";
import {
  handleKeywordSearchVolume,
  handleKeywordsByAsin,
  handleProductDatabaseQuery,
  handleSalesEstimates,
  handleShareOfVoice,
} from "../src/tools.js";
import { MISSING_CREDS_MESSAGE } from "../src/constants.js";

import keywordSearchVolumeFixture from "./fixtures/keyword_search_volume.json" assert { type: "json" };
import keywordsByAsinFixture from "./fixtures/keywords_by_asin.json" assert { type: "json" };
import productDatabaseFixture from "./fixtures/product_database.json" assert { type: "json" };
import salesEstimatesFixture from "./fixtures/sales_estimates.json" assert { type: "json" };
import shareOfVoiceFixture from "./fixtures/share_of_voice.json" assert { type: "json" };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeClient(): JsClient {
  return new JsClient({ apiKey: "test-api-key", keyName: "test-key-name" });
}

function mockFetch(fixture: unknown, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? "OK" : "Error",
      json: async () => fixture,
    }),
  );
}

function extractText(result: {
  content: Array<{ type: string; text: string }>;
}): string {
  return result.content.map((c) => c.text).join("");
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Missing credentials
// ---------------------------------------------------------------------------

describe("missing credentials", () => {
  it("keyword_search_volume returns instructions when client is null", async () => {
    const result = await handleKeywordSearchVolume(
      { keywords: ["yoga mat"], marketplace: "us" },
      null,
    );
    const text = extractText(result);
    expect(text).toContain(MISSING_CREDS_MESSAGE);
    expect(text).toContain("JUNGLESCOUT_API_KEY");
  });

  it("keywords_by_asin returns instructions when client is null", async () => {
    const result = await handleKeywordsByAsin(
      { asin: "B07XJ8C8F5", marketplace: "us", page_size: 20 },
      null,
    );
    const text = extractText(result);
    expect(text).toContain(MISSING_CREDS_MESSAGE);
  });

  it("product_database_query returns instructions when client is null", async () => {
    const result = await handleProductDatabaseQuery(
      { marketplace: "us", page_size: 20 },
      null,
    );
    const text = extractText(result);
    expect(text).toContain(MISSING_CREDS_MESSAGE);
  });

  it("sales_estimates returns instructions when client is null", async () => {
    const result = await handleSalesEstimates(
      { asin: "B07XJ8C8F5", marketplace: "us" },
      null,
    );
    const text = extractText(result);
    expect(text).toContain(MISSING_CREDS_MESSAGE);
  });

  it("share_of_voice returns instructions when client is null", async () => {
    const result = await handleShareOfVoice(
      { keyword: "yoga mat", marketplace: "us" },
      null,
    );
    const text = extractText(result);
    expect(text).toContain(MISSING_CREDS_MESSAGE);
  });
});

// ---------------------------------------------------------------------------
// keyword_search_volume
// ---------------------------------------------------------------------------

describe("keyword_search_volume", () => {
  it("returns volume data for requested keywords", async () => {
    mockFetch(keywordSearchVolumeFixture);
    const client = makeClient();

    const result = await handleKeywordSearchVolume(
      { keywords: ["yoga mat", "yoga block"], marketplace: "us" },
      client,
    );

    const text = extractText(result);
    const data = JSON.parse(text);

    expect(data.marketplace).toBe("us");
    expect(data.results_count).toBe(2);
    expect(data.results[0].keyword).toBe("yoga mat");
    expect(data.results[0].exact_match_volume_30d).toBe(450000);
    expect(data.results[0].ease_of_ranking_score).toBe(62);
    expect(data.results[1].keyword).toBe("yoga block");
    expect(data.results[1].exact_match_volume_30d).toBe(85000);
  });

  it("includes ppc bid data", async () => {
    mockFetch(keywordSearchVolumeFixture);
    const client = makeClient();

    const result = await handleKeywordSearchVolume(
      { keywords: ["yoga mat"], marketplace: "us" },
      client,
    );

    const data = JSON.parse(extractText(result));
    expect(data.results[0].ppc_bid_exact).toBe(1.87);
    expect(data.results[0].ppc_bid_broad).toBe(1.24);
  });

  it("returns error text on API failure", async () => {
    mockFetch({ errors: [{ detail: "Unauthorized" }] }, 401);
    const client = makeClient();

    const result = await handleKeywordSearchVolume(
      { keywords: ["yoga mat"], marketplace: "us" },
      client,
    );

    const text = extractText(result);
    expect(text).toContain("Authentication failed");
    expect((result as { isError?: boolean }).isError).toBe(true);
  });

  it("handles rate limit response gracefully", async () => {
    mockFetch({}, 429);
    const client = makeClient();

    const result = await handleKeywordSearchVolume(
      { keywords: ["test"], marketplace: "us" },
      client,
    );

    const text = extractText(result);
    expect(text).toContain("Rate limit");
    expect((result as { isError?: boolean }).isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// keywords_by_asin
// ---------------------------------------------------------------------------

describe("keywords_by_asin", () => {
  it("returns keywords driving a listing", async () => {
    mockFetch(keywordsByAsinFixture);
    const client = makeClient();

    const result = await handleKeywordsByAsin(
      { asin: "B07XJ8C8F5", marketplace: "us", page_size: 20 },
      client,
    );

    const data = JSON.parse(extractText(result));

    expect(data.asin).toBe("B07XJ8C8F5");
    expect(data.marketplace).toBe("us");
    expect(data.results_count).toBe(2);
    expect(data.keywords[0].keyword).toBe("yoga mat");
    expect(data.keywords[0].organic_rank).toBe(3);
    expect(data.keywords[1].keyword).toBe("non slip yoga mat");
    expect(data.keywords[1].sponsored_rank).toBe(2);
  });

  it("passes the correct ASIN in request params", async () => {
    mockFetch(keywordsByAsinFixture);
    const client = makeClient();
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await handleKeywordsByAsin(
      { asin: "B07XJ8C8F5", marketplace: "us", page_size: 10 },
      client,
    );

    const callUrl = String((fetchSpy.mock.calls[0] as [string])[0]);
    expect(callUrl).toContain("B07XJ8C8F5");
    expect(callUrl).toContain("keywords_by_asin_query");
  });

  it("returns error text on API failure", async () => {
    mockFetch({ errors: [{ detail: "Invalid ASIN" }] }, 422);
    const client = makeClient();

    const result = await handleKeywordsByAsin(
      { asin: "B07XJ8C8F5", marketplace: "us", page_size: 20 },
      client,
    );

    const text = extractText(result);
    expect(text).toContain("Invalid request parameters");
    expect((result as { isError?: boolean }).isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// product_database_query
// ---------------------------------------------------------------------------

describe("product_database_query", () => {
  it("returns product opportunities with filters", async () => {
    mockFetch(productDatabaseFixture);
    const client = makeClient();

    const result = await handleProductDatabaseQuery(
      {
        marketplace: "us",
        category: "Sports & Outdoors",
        min_price: 15,
        max_price: 50,
        min_monthly_revenue: 5000,
        max_reviews: 2000,
        page_size: 20,
      },
      client,
    );

    const data = JSON.parse(extractText(result));

    expect(data.marketplace).toBe("us");
    expect(data.filters_applied.category).toBe("Sports & Outdoors");
    expect(data.filters_applied.price_range).toEqual({ min: 15, max: 50 });
    expect(data.results_count).toBe(2);
    expect(data.products[0].asin).toBe("B07XJ8C8F5");
    expect(data.products[0].monthly_revenue).toBe(87500);
    expect(data.products[0].seller_type).toBe("FBA");
  });

  it("works without optional filters", async () => {
    mockFetch(productDatabaseFixture);
    const client = makeClient();

    const result = await handleProductDatabaseQuery(
      { marketplace: "us", page_size: 20 },
      client,
    );

    const data = JSON.parse(extractText(result));
    expect(data.filters_applied.category).toBeNull();
    expect(data.filters_applied.price_range).toBeNull();
    expect(data.results_count).toBe(2);
  });

  it("returns error text on API failure", async () => {
    mockFetch({ errors: [{ title: "Server Error" }] }, 500);
    const client = makeClient();

    const result = await handleProductDatabaseQuery(
      { marketplace: "us", page_size: 20 },
      client,
    );

    const text = extractText(result);
    expect(text).toContain("500");
    expect((result as { isError?: boolean }).isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// sales_estimates
// ---------------------------------------------------------------------------

describe("sales_estimates", () => {
  it("returns monthly sales estimate for an ASIN", async () => {
    mockFetch(salesEstimatesFixture);
    const client = makeClient();

    const result = await handleSalesEstimates(
      { asin: "B07XJ8C8F5", marketplace: "us" },
      client,
    );

    const data = JSON.parse(extractText(result));

    expect(data.asin).toBe("B07XJ8C8F5");
    expect(data.marketplace).toBe("us");
    expect(data.estimates.monthly_units_sold).toBe(3017);
    expect(data.estimates.monthly_revenue).toBeCloseTo(87463.83, 1);
    expect(data.estimates.bsr_category).toBe("Sports & Outdoors");
    expect(data.estimates.brand).toBe("FitLife");
  });

  it("handles empty data gracefully", async () => {
    mockFetch({ data: [], meta: {} });
    const client = makeClient();

    const result = await handleSalesEstimates(
      { asin: "B00INVALID0", marketplace: "us" },
      client,
    );

    const data = JSON.parse(extractText(result));
    expect(data.message).toContain("No sales estimate data found");
  });

  it("returns error text on API failure", async () => {
    mockFetch({ errors: [{ detail: "Not found" }] }, 404);
    const client = makeClient();

    const result = await handleSalesEstimates(
      { asin: "B07XJ8C8F5", marketplace: "us" },
      client,
    );

    const text = extractText(result);
    expect(text).toContain("404");
    expect((result as { isError?: boolean }).isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// share_of_voice
// ---------------------------------------------------------------------------

describe("share_of_voice", () => {
  it("returns brand share data sorted by combined SOV", async () => {
    mockFetch(shareOfVoiceFixture);
    const client = makeClient();

    const result = await handleShareOfVoice(
      { keyword: "yoga mat", marketplace: "us" },
      client,
    );

    const data = JSON.parse(extractText(result));

    expect(data.keyword).toBe("yoga mat");
    expect(data.marketplace).toBe("us");
    expect(data.search_volume).toBe(450000);
    expect(data.brands_count).toBe(3);

    // Should be sorted by combined_sov descending
    expect(data.brands[0].brand).toBe("FitLife");
    expect(data.brands[0].combined_sov).toBe(0.18);
    expect(data.brands[1].brand).toBe("Gaiam");
    expect(data.brands[2].brand).toBe("Manduka");
  });

  it("includes organic vs sponsored breakdown", async () => {
    mockFetch(shareOfVoiceFixture);
    const client = makeClient();

    const result = await handleShareOfVoice(
      { keyword: "yoga mat", marketplace: "us" },
      client,
    );

    const data = JSON.parse(extractText(result));
    const fitlife = data.brands[0];
    expect(fitlife.organic_sov).toBe(0.15);
    expect(fitlife.sponsored_sov).toBe(0.03);
  });

  it("returns error text on API failure", async () => {
    mockFetch({ errors: [{ detail: "Unauthorized" }] }, 401);
    const client = makeClient();

    const result = await handleShareOfVoice(
      { keyword: "yoga mat", marketplace: "us" },
      client,
    );

    const text = extractText(result);
    expect(text).toContain("Authentication failed");
    expect((result as { isError?: boolean }).isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// JsClient: auth header format
// ---------------------------------------------------------------------------

describe("JsClient auth header", () => {
  it("sends Authorization header as KEY_NAME:API_KEY format", async () => {
    mockFetch(keywordSearchVolumeFixture);
    const client = new JsClient({
      apiKey: "my-secret-key",
      keyName: "my-key-name",
    });

    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await handleKeywordSearchVolume(
      { keywords: ["test"], marketplace: "us" },
      client,
    );

    const callInit = (fetchSpy.mock.calls[0] as [string, RequestInit])[1];
    const headers = callInit.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("my-key-name:my-secret-key");
    expect(headers["X-API-Type"]).toBe("junglescout");
    expect(headers["Content-Type"]).toBe("application/vnd.api+json");
  });
});
