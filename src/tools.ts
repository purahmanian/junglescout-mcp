// Tool schemas and handler implementations

import { z } from "zod";
import { JsClient, JsApiError } from "./client.js";
import {
  MISSING_CREDS_MESSAGE,
  DEFAULT_MARKETPLACE,
  MAX_KEYWORDS_PER_REQUEST,
  SUPPORTED_MARKETPLACES,
} from "./constants.js";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function ok(text: string): { content: Array<{ type: "text"; text: string }> } {
  return { content: [{ type: "text" as const, text }] };
}

function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

function credsError(): {
  content: Array<{ type: "text"; text: string }>;
  isError: boolean;
} {
  return {
    content: [{ type: "text" as const, text: MISSING_CREDS_MESSAGE }],
    isError: true,
  };
}

function apiError(err: unknown): {
  content: Array<{ type: "text"; text: string }>;
  isError: boolean;
} {
  const message =
    err instanceof JsApiError
      ? `Jungle Scout API error (${err.status}): ${err.message}`
      : err instanceof Error
        ? `Unexpected error: ${err.message}`
        : "An unknown error occurred.";
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

/** A single JSON:API resource object. */
interface JsResource {
  id: string;
  type: string;
  attributes: Record<string, unknown>;
}

/** Derive the ASIN from a JSON:API id like "us/B07XJ8C8F5". */
function asinFromId(id: string): string {
  const parts = id.split("/");
  return parts[parts.length - 1] ?? id;
}

/** Format a Date as YYYY-MM-DD (UTC). */
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Cap on how many seed keywords keyword_search_volume will look up per call.
// Each seed is a separate upstream request, so this bounds latency and tokens.
const MAX_KEYWORD_SEEDS = 10;

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

export const KeywordSearchVolumeSchema = z.object({
  keywords: z
    .array(z.string().min(1))
    .min(1)
    .max(MAX_KEYWORDS_PER_REQUEST)
    .describe(
      `Keywords to look up exact and broad monthly search volume for. ` +
        `Each keyword is queried individually (up to ${MAX_KEYWORD_SEEDS} per ` +
        `call are processed). Example: ["yoga mat", "resistance bands"]`,
    ),
  marketplace: z
    .enum(SUPPORTED_MARKETPLACES)
    .default(DEFAULT_MARKETPLACE)
    .describe("Amazon marketplace code. Defaults to 'us'."),
});

export const KeywordsByAsinSchema = z.object({
  asin: z
    .string()
    .regex(
      /^[A-Z0-9]{10}$/,
      "ASIN must be exactly 10 uppercase alphanumeric characters",
    )
    .describe("Amazon ASIN. Example: B07XJ8C8F5"),
  marketplace: z
    .enum(SUPPORTED_MARKETPLACES)
    .default(DEFAULT_MARKETPLACE)
    .describe("Amazon marketplace code. Defaults to 'us'."),
  page_size: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(25)
    .describe("Number of keywords to return (1-100). Defaults to 25."),
});

export const ProductDatabaseQuerySchema = z.object({
  marketplace: z
    .enum(SUPPORTED_MARKETPLACES)
    .default(DEFAULT_MARKETPLACE)
    .describe("Amazon marketplace code. Defaults to 'us'."),
  category: z
    .string()
    .optional()
    .describe("Amazon category name to filter by. Example: 'Sports & Outdoors'"),
  min_price: z
    .number()
    .min(0)
    .optional()
    .describe("Minimum price in USD. Example: 15"),
  max_price: z
    .number()
    .min(0)
    .optional()
    .describe("Maximum price in USD. Example: 50"),
  min_monthly_revenue: z
    .number()
    .min(0)
    .optional()
    .describe("Minimum estimated monthly revenue in USD. Example: 5000"),
  max_reviews: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      "Maximum number of reviews (to find low-competition products). Example: 200",
    ),
  page_size: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(25)
    .describe("Number of results to return (1-100). Defaults to 25."),
});

export const SalesEstimatesSchema = z.object({
  asin: z
    .string()
    .regex(
      /^[A-Z0-9]{10}$/,
      "ASIN must be exactly 10 uppercase alphanumeric characters",
    )
    .describe("Amazon ASIN. Example: B07XJ8C8F5"),
  marketplace: z
    .enum(SUPPORTED_MARKETPLACES)
    .default(DEFAULT_MARKETPLACE)
    .describe("Amazon marketplace code. Defaults to 'us'."),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .optional()
    .describe("Start date YYYY-MM-DD. Defaults to 30 days ago."),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .optional()
    .describe("End date YYYY-MM-DD (must be before today). Defaults to yesterday."),
});

export const ShareOfVoiceSchema = z.object({
  keyword: z
    .string()
    .min(1)
    .describe("Search keyword to analyze brand share for. Example: 'protein powder'"),
  marketplace: z
    .enum(SUPPORTED_MARKETPLACES)
    .default(DEFAULT_MARKETPLACE)
    .describe("Amazon marketplace code. Defaults to 'us'."),
});

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

export async function handleKeywordSearchVolume(
  args: z.infer<typeof KeywordSearchVolumeSchema>,
  client: JsClient | null,
): Promise<ReturnType<typeof ok>> {
  if (!client) return credsError();

  const seeds = args.keywords.slice(0, MAX_KEYWORD_SEEDS);
  const truncated = args.keywords.length - seeds.length;

  try {
    const results: Array<Record<string, unknown>> = [];

    for (const seed of seeds) {
      // POST /keywords/keywords_by_keyword_query
      // marketplace, sort, and paging are QUERY params; the seed is the body.
      const resp = await client.request<{ data?: JsResource[] }>({
        method: "POST",
        path: "/keywords/keywords_by_keyword_query",
        params: {
          marketplace: args.marketplace,
          sort: "-monthly_search_volume_exact",
          "page[size]": 50,
        },
        body: {
          data: {
            type: "keywords_by_keyword_query",
            attributes: { search_terms: seed },
          },
        },
      });

      const rows = resp.data ?? [];
      const match =
        rows.find(
          (r) =>
            String(r.attributes?.["name"] ?? "").toLowerCase() ===
            seed.toLowerCase(),
        ) ?? rows[0];

      if (!match) {
        results.push({ keyword: seed, found: false });
        continue;
      }

      const a = match.attributes;
      results.push({
        keyword: a["name"] ?? seed,
        exact_search_volume: a["monthly_search_volume_exact"] ?? null,
        broad_search_volume: a["monthly_search_volume_broad"] ?? null,
        monthly_trend: a["monthly_trend"] ?? null,
        quarterly_trend: a["quarterly_trend"] ?? null,
        dominant_category: a["dominant_category"] ?? null,
        ppc_bid_exact: a["ppc_bid_exact"] ?? null,
        ppc_bid_broad: a["ppc_bid_broad"] ?? null,
        ease_of_ranking_score: a["ease_of_ranking_score"] ?? null,
        relevancy_score: a["relevancy_score"] ?? null,
        organic_product_count: a["organic_product_count"] ?? null,
      });
    }

    const summary: Record<string, unknown> = {
      requested_keywords: seeds,
      marketplace: args.marketplace,
      results_count: results.length,
      results,
    };
    if (truncated > 0) {
      summary["note"] = `Only the first ${MAX_KEYWORD_SEEDS} keywords were processed; ${truncated} were skipped.`;
    }

    return ok(formatJson(summary));
  } catch (err) {
    return apiError(err);
  }
}

export async function handleKeywordsByAsin(
  args: z.infer<typeof KeywordsByAsinSchema>,
  client: JsClient | null,
): Promise<ReturnType<typeof ok>> {
  if (!client) return credsError();

  try {
    // POST /keywords/keywords_by_asin_query with the ASIN in the body.
    const result = await client.request<{ data?: JsResource[] }>({
      method: "POST",
      path: "/keywords/keywords_by_asin_query",
      params: {
        marketplace: args.marketplace,
        sort: "-monthly_search_volume_exact",
        "page[size]": args.page_size,
      },
      body: {
        data: {
          type: "keywords_by_asin_query",
          attributes: { asins: [args.asin] },
        },
      },
    });

    const rows = (result.data ?? []).map((item) => {
      const a = item.attributes;
      return {
        keyword: a["name"] ?? item.id,
        exact_search_volume: a["monthly_search_volume_exact"] ?? null,
        broad_search_volume: a["monthly_search_volume_broad"] ?? null,
        relevancy_score: a["relevancy_score"] ?? null,
        organic_rank: a["organic_rank"] ?? null,
        sponsored_rank: a["sponsored_rank"] ?? null,
        overall_rank: a["overall_rank"] ?? null,
        ease_of_ranking_score: a["ease_of_ranking_score"] ?? null,
      };
    });

    const summary = {
      asin: args.asin,
      marketplace: args.marketplace,
      results_count: rows.length,
      keywords: rows,
    };

    return ok(formatJson(summary));
  } catch (err) {
    return apiError(err);
  }
}

export async function handleProductDatabaseQuery(
  args: z.infer<typeof ProductDatabaseQuerySchema>,
  client: JsClient | null,
): Promise<ReturnType<typeof ok>> {
  if (!client) return credsError();

  try {
    const attributes: Record<string, unknown> = {};
    if (args.category !== undefined) attributes["categories"] = [args.category];
    if (args.min_price !== undefined) attributes["min_price"] = args.min_price;
    if (args.max_price !== undefined) attributes["max_price"] = args.max_price;
    if (args.min_monthly_revenue !== undefined)
      attributes["min_revenue"] = args.min_monthly_revenue;
    if (args.max_reviews !== undefined)
      attributes["max_reviews"] = args.max_reviews;

    const result = await client.request<{ data?: JsResource[] }>({
      method: "POST",
      path: "/product_database_query",
      params: {
        marketplace: args.marketplace,
        sort: "-revenue",
        "page[size]": args.page_size,
      },
      body: {
        data: { type: "product_database_query", attributes },
      },
    });

    const products = (result.data ?? []).map((item) => {
      const a = item.attributes;
      return {
        asin: asinFromId(item.id),
        title: a["title"] ?? null,
        brand: a["brand"] ?? null,
        category: a["category"] ?? null,
        price: a["price"] ?? null,
        monthly_revenue: a["approximate_30_day_revenue"] ?? null,
        monthly_units_sold: a["approximate_30_day_units_sold"] ?? null,
        reviews_count: a["reviews"] ?? null,
        avg_rating: a["rating"] ?? null,
        product_rank: a["product_rank"] ?? null,
        seller_type: a["seller_type"] ?? null,
        number_of_sellers: a["number_of_sellers"] ?? null,
        listing_quality_score: a["listing_quality_score"] ?? null,
      };
    });

    const summary = {
      marketplace: args.marketplace,
      filters_applied: {
        category: args.category ?? null,
        price_range:
          args.min_price !== undefined || args.max_price !== undefined
            ? { min: args.min_price ?? null, max: args.max_price ?? null }
            : null,
        min_monthly_revenue: args.min_monthly_revenue ?? null,
        max_reviews: args.max_reviews ?? null,
      },
      results_count: products.length,
      products,
    };

    return ok(formatJson(summary));
  } catch (err) {
    return apiError(err);
  }
}

export async function handleSalesEstimates(
  args: z.infer<typeof SalesEstimatesSchema>,
  client: JsClient | null,
): Promise<ReturnType<typeof ok>> {
  if (!client) return credsError();

  // Default to the last 30 days ending yesterday (end_date must be before today).
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const thirtyBefore = new Date(yesterday.getTime() - 29 * 24 * 60 * 60 * 1000);
  const startDate = args.start_date ?? ymd(thirtyBefore);
  const endDate = args.end_date ?? ymd(yesterday);

  try {
    // GET /sales_estimates_query with everything in the query string.
    const result = await client.request<{ data?: JsResource[] }>({
      method: "GET",
      path: "/sales_estimates_query",
      params: {
        marketplace: args.marketplace,
        asin: args.asin,
        start_date: startDate,
        end_date: endDate,
      },
    });

    const item = result.data?.[0];
    if (!item) {
      return ok(
        formatJson({
          asin: args.asin,
          marketplace: args.marketplace,
          date_range: { start: startDate, end: endDate },
          message: "No sales estimate data found for this ASIN and date range.",
        }),
      );
    }

    const a = item.attributes;
    const daily = Array.isArray(a["data"])
      ? (a["data"] as Array<Record<string, unknown>>)
      : [];

    let totalUnits = 0;
    let totalRevenue = 0;
    let daysWithData = 0;
    for (const day of daily) {
      const units = Number(day["estimated_units_sold"] ?? 0);
      const price = Number(day["last_known_price"] ?? 0);
      if (Number.isFinite(units) && units > 0) {
        totalUnits += units;
        if (Number.isFinite(price)) totalRevenue += units * price;
        daysWithData += 1;
      }
    }

    const summary = {
      asin: args.asin,
      marketplace: args.marketplace,
      date_range: { start: startDate, end: endDate },
      is_parent: a["is_parent"] ?? null,
      is_variant: a["is_variant"] ?? null,
      estimates: {
        estimated_units_sold_total: totalUnits,
        estimated_revenue_total: Math.round(totalRevenue * 100) / 100,
        days_with_data: daysWithData,
      },
      daily,
    };

    return ok(formatJson(summary));
  } catch (err) {
    return apiError(err);
  }
}

export async function handleShareOfVoice(
  args: z.infer<typeof ShareOfVoiceSchema>,
  client: JsClient | null,
): Promise<ReturnType<typeof ok>> {
  if (!client) return credsError();

  try {
    // GET /share_of_voice. Note: `data` is a single object, not an array.
    const result = await client.request<{ data?: JsResource }>({
      method: "GET",
      path: "/share_of_voice",
      params: {
        marketplace: args.marketplace,
        keyword: args.keyword,
      },
    });

    const attrs = result.data?.attributes ?? {};
    const brandList = Array.isArray(attrs["brands"])
      ? (attrs["brands"] as Array<Record<string, unknown>>)
      : [];

    const brands = brandList.map((b) => ({
      brand: b["brand"] ?? null,
      combined_weighted_sov: b["combined_weighted_sov"] ?? null,
      combined_basic_sov: b["combined_basic_sov"] ?? null,
      organic_weighted_sov: b["organic_weighted_sov"] ?? null,
      sponsored_weighted_sov: b["sponsored_weighted_sov"] ?? null,
      combined_products: b["combined_products"] ?? null,
      organic_products: b["organic_products"] ?? null,
      sponsored_products: b["sponsored_products"] ?? null,
      combined_average_price: b["combined_average_price"] ?? null,
    }));

    brands.sort((x, y) => {
      const sx = typeof x.combined_weighted_sov === "number" ? x.combined_weighted_sov : 0;
      const sy = typeof y.combined_weighted_sov === "number" ? y.combined_weighted_sov : 0;
      return sy - sx;
    });

    const summary = {
      keyword: args.keyword,
      marketplace: args.marketplace,
      search_volume: attrs["estimated_30_day_search_volume"] ?? null,
      product_count: attrs["product_count"] ?? null,
      brands_count: brands.length,
      brands,
    };

    return ok(formatJson(summary));
  } catch (err) {
    return apiError(err);
  }
}
