// Jungle Scout API client

import { JS_API_BASE, JS_CONTENT_TYPE } from "./constants.js";

export interface JsClientConfig {
  apiKey: string;
  keyName: string;
}

export interface JsRequestOptions {
  method?: "GET" | "POST";
  path: string;
  params?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

export interface JsErrorDetail {
  status: number;
  message: string;
}

export class JsApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "JsApiError";
  }
}

export class JsClient {
  private readonly apiKey: string;
  private readonly keyName: string;

  constructor(config: JsClientConfig) {
    this.apiKey = config.apiKey;
    this.keyName = config.keyName;
  }

  private buildUrl(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
  ): string {
    const url = new URL(`${JS_API_BASE}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }

  async request<T = unknown>(options: JsRequestOptions): Promise<T> {
    const { method = "GET", path, params, body } = options;
    const url = this.buildUrl(path, params);

    const headers: Record<string, string> = {
      Authorization: `${this.keyName}:${this.apiKey}`,
      "X-API-Type": "junglescout",
      "Content-Type": JS_CONTENT_TYPE,
      Accept: JS_CONTENT_TYPE,
    };

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (body !== undefined) {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorBody = (await response.json()) as {
          errors?: Array<{ detail?: string; title?: string }>;
        };
        if (errorBody.errors && errorBody.errors.length > 0) {
          const first = errorBody.errors[0];
          errorMessage = first.detail ?? first.title ?? errorMessage;
        }
      } catch {
        // ignore JSON parse errors on error body
      }

      if (response.status === 401 || response.status === 403) {
        throw new JsApiError(
          response.status,
          `Authentication failed: ${errorMessage}. Check your JUNGLESCOUT_API_KEY and JUNGLESCOUT_KEY_NAME values.`,
        );
      }
      if (response.status === 422) {
        throw new JsApiError(
          response.status,
          `Invalid request parameters: ${errorMessage}`,
        );
      }
      if (response.status === 429) {
        throw new JsApiError(
          response.status,
          "Rate limit exceeded. Please wait before retrying.",
        );
      }
      throw new JsApiError(response.status, errorMessage);
    }

    return (await response.json()) as T;
  }
}
