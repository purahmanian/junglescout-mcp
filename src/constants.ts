// Jungle Scout API constants

export const JS_API_BASE = "https://developer.junglescout.com/api";

// Content type required by the Jungle Scout JSON:API spec
export const JS_CONTENT_TYPE = "application/vnd.api+json";

// Supported marketplace slugs
export const SUPPORTED_MARKETPLACES = [
  "us",
  "ca",
  "mx",
  "br",
  "uk",
  "de",
  "fr",
  "it",
  "es",
  "nl",
  "pl",
  "se",
  "tr",
  "ae",
  "in",
  "sg",
  "au",
  "jp",
] as const;

export type Marketplace = (typeof SUPPORTED_MARKETPLACES)[number];

export const DEFAULT_MARKETPLACE: Marketplace = "us";

// Maximum keywords per request for keyword_search_volume
export const MAX_KEYWORDS_PER_REQUEST = 100;

// Message shown when API credentials are missing
export const MISSING_CREDS_MESSAGE =
  "Jungle Scout API credentials are not configured. " +
  "Set the JUNGLESCOUT_API_KEY and JUNGLESCOUT_KEY_NAME environment variables. " +
  "API access requires a Jungle Scout plan that includes Developer API access. " +
  "See https://www.junglescout.com/pricing/ for plan options.";
