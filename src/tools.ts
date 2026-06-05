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

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

export const KeywordSearchVolumeSchema = z.object({
  keywords: z
    .array(z.string().min(1))
    .min(1)
    .max(MAX_KEYWORDS_PER_REQUEST)
    .describe(
      `List of keywords to look up (1 to ${MAX_KEYWORDS_PER_REQUEST}). Example: ["yoga mat", "resistance bands"]`,
    ),
  marketplace: z
    .enum(SUPPORTED_MARKETPLACES)
    .default(DEFAULT_MARKETPLACE)
    .describe("Amazon marketplace code. Defaults to 'us'."),
});

export const KeywordsByAsinSchema = z.object({
  asin: z
    .string()
    .regex(/^[A-Z0-9]{10}$/, "ASIN must be exactly 10 uppercase alphanumeric characters")
    .describe("Amazon ASIN. Example: B07XJ8C8F5"),
  marketplace: z
    .enum(SUPPORTED_MARKETPLACES)
    .default(DEFAULT_MARKETPLACE)
    .describe("Amazon marketplace code. Defaults to 'us'."),
  page_size: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20)
    .describe("Number of keywords to return (1-50). Defaults to 20."),
});

export const ProductDatabaseQuerySchema = z.object({
  marketplace: z
    .enum(SUPPORTED_MARKETPLACES)
    .default(DEFAULT_MARKETPLACE)
    .describe("Amazon marketplace code. Defaults to 'us'."),
  category: z
    .string()
    .optional()
    .describe(
      "Amazon category name to filter by. Example: 'Sports & Outdoors'",
    ),
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
    .describe("Maximum number of reviews (to find low-competition products). Example: 200"),
  page_size: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20)
    .describe("Number of results to return (1-50). Defaults to 20."),
});

export const SalesEstimatesSchema = z.object({
  asin: z
    .string()
    .regex(/^[A-Z0-9]{10}$/, "ASIN must be exactly 10 uppercase alphanumeric characters")
    .describe("Amazon ASIN. Example: B07XJ8C8F5"),
  marketplace: z
    .enum(SUPPORTED_MARKETPLACES)
    .default(DEFAULT_MARKETPLACE)
    .describe("Amazon marketplace code. Defaults to 'us'."),
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

  try {
    // POST /keywords/keywords_by_keyword_query
    const body = {
      data: {
        type: "keywords_by_keyword_query",
        attributes: {
          search_terms: args.keywords,
          marketplace: args.marketplace,
          sort_by: "monthly_search_volume_exact_match",
        },
      },
    };

    const result = await client.request<{
      data: Array<{
        id: string;
        type: string;
        attributes: Record<string, unknown>;
      }>;
      meta?: Record<string, unknown>;
    }>({
      method: "POST",
      path: "/keywords/keywords_by_keyword_query",
      body,
    });

    const rows = (result.data ?? []).map((item) => {
      const a = item.attributes;
      return {
        keyword: a["name"] ?? item.id,
        exact_match_volume_30d: a["monthly_search_volume_exact_match"] ?? null,
        broad_match_volume_30d: a["monthly_search_volume_broad_match"] ?? null,
        yoy_trend: a["monthly_trend"] ?? null,
        quarterly_trend: a["quarterly_trend"] ?? null,
        recommended_promotions: a["recommended_promotions"] ?? null,
        ppc_bid_broad: a["ppc_bid_broad"] ?? null,
        ppc_bid_exact: a["ppc_bid_exact"] ?? null,
        ease_of_ranking_score: a["ease_of_ranking_score"] ?? null,
        relevancy_score: a["relevancy_score"] ?? null,
      };
    });

    const summary = {
      requested_keywords: args.keywords,
      marketplace: args.marketplace,
      results_count: rows.length,
      results: rows,
    };

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
    const result = await client.request<{
      data: Array<{
        id: string;
        type: string;
        attributes: Record<string, unknown>;
      }>;
      meta?: Record<string, unknown>;
      links?: Record<string, unknown>;
    }>({
      method: "GET",
      path: "/keywords/keywords_by_asin_query",
      params: {
        "filter[asin]": args.asin,
        "filter[marketplace]": args.marketplace,
        "page[size]": args.page_size,
      },
    });

    const rows = (result.data ?? []).map((item) => {
      const a = item.attributes;
      return {
        keyword: a["name"] ?? item.id,
        exact_match_volume_30d: a["monthly_search_volume_exact_match"] ?? null,
        broad_match_volume_30d: a["monthly_search_volume_broad_match"] ?? null,
        relevancy_score: a["relevancy_score"] ?? null,
        organic_rank: a["organic_rank"] ?? null,
        sponsored_rank: a["sponsored_rank"] ?? null,
        ranking_asins_count: a["ranking_asins_count"] ?? null,
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
    // Build filter attributes conditionally
    const filterAttributes: Record<string, unknown> = {
      marketplace: args.marketplace,
    };

    if (args.category !== undefined) {
      filterAttributes["category"] = args.category;
    }
    if (args.min_price !== undefined) {
      filterAttributes["price_gte"] = args.min_price;
    }
    if (args.max_price !== undefined) {
      filterAttributes["price_lte"] = args.max_price;
    }
    if (args.min_monthly_revenue !== undefined) {
      filterAttributes["monthly_revenue_gte"] = args.min_monthly_revenue;
    }
    if (args.max_reviews !== undefined) {
      filterAttributes["reviews_lte"] = args.max_reviews;
    }

    const body = {
      data: {
        type: "product_database_query",
        attributes: {
          ...filterAttributes,
          page_size: args.page_size,
          sort_by: "monthly_revenue",
          sort_order: "desc",
        },
      },
    };

    const result = await client.request<{
      data: Array<{
        id: string;
        type: string;
        attributes: Record<string, unknown>;
      }>;
      meta?: Record<string, unknown>;
    }>({
      method: "POST",
      path: "/product_database_query",
      body,
    });

    const products = (result.data ?? []).map((item) => {
      const a = item.attributes;
      return {
        asin: a["asin"] ?? item.id,
        title: a["title"] ?? null,
        brand: a["brand"] ?? null,
        category: a["category"] ?? null,
        price: a["price"] ?? null,
        monthly_revenue: a["monthly_revenue"] ?? null,
        monthly_units_sold: a["monthly_units_sold"] ?? null,
        reviews_count: a["reviews"] ?? null,
        avg_rating: a["rating"] ?? null,
        bsr: a["bsr"] ?? null,
        seller_type: a["seller_type"] ?? null,
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

  try {
    const result = await client.request<{
      data: Array<{
        id: string;
        type: string;
        attributes: Record<string, unknown>;
      }>;
      meta?: Record<string, unknown>;
    }>({
      method: "GET",
      path: "/sales_estimates_query",
      params: {
        "filter[asin]": args.asin,
        "filter[marketplace]": args.marketplace,
        "filter[date]": new Date().toISOString().slice(0, 7), // YYYY-MM
      },
    });

    const item = result.data?.[0];
    if (!item) {
      return ok(
        formatJson({
          asin: args.asin,
          marketplace: args.marketplace,
          message: "No sales estimate data found for this ASIN.",
        }),
      );
    }

    const a = item.attributes;
    const summary = {
      asin: args.asin,
      marketplace: args.marketplace,
      estimates: {
        monthly_units_sold: a["monthly_units_sold"] ?? null,
        monthly_revenue: a["monthly_revenue"] ?? null,
        avg_daily_units: a["avg_daily_units"] ?? null,
        bsr: a["bsr"] ?? null,
        bsr_category: a["bsr_category"] ?? null,
        price: a["price"] ?? null,
        reviews: a["reviews"] ?? null,
        rating: a["rating"] ?? null,
        title: a["title"] ?? null,
        brand: a["brand"] ?? null,
      },
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
    const result = await client.request<{
      data: Array<{
        id: string;
        type: string;
        attributes: Record<string, unknown>;
      }>;
      meta?: Record<string, unknown>;
    }>({
      method: "GET",
      path: "/share_of_voice",
      params: {
        "filter[keyword]": args.keyword,
        "filter[marketplace]": args.marketplace,
      },
    });

    const brands = (result.data ?? []).map((item) => {
      const a = item.attributes;
      return {
        brand: a["brand"] ?? item.id,
        combined_sov: a["combined_sov"] ?? null,
        organic_sov: a["organic_sov"] ?? null,
        sponsored_sov: a["sponsored_sov"] ?? null,
        combined_products: a["combined_products"] ?? null,
        organic_products: a["organic_products"] ?? null,
        sponsored_products: a["sponsored_products"] ?? null,
        avg_price: a["avg_price"] ?? null,
        avg_reviews: a["avg_reviews"] ?? null,
        avg_rating: a["avg_rating"] ?? null,
      };
    });

    // Sort by combined SOV descending for clarity
    brands.sort((a, b) => {
      const sovA = typeof a.combined_sov === "number" ? a.combined_sov : 0;
      const sovB = typeof b.combined_sov === "number" ? b.combined_sov : 0;
      return sovB - sovA;
    });

    const meta = result.meta ?? {};

    const summary = {
      keyword: args.keyword,
      marketplace: args.marketplace,
      search_volume: (meta as Record<string, unknown>)["search_volume"] ?? null,
      brands_count: brands.length,
      brands,
    };

    return ok(formatJson(summary));
  } catch (err) {
    return apiError(err);
  }
}
