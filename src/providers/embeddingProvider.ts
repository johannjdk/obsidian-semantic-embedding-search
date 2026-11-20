import type {
  EmbeddingProvider,
  EmbeddingProviderType,
  HttpClient,
  SemanticSearchSettings,
} from "../types";

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly id: EmbeddingProviderType = "ollama";
  readonly model: string;
  private readonly baseUrl: string;
  private readonly http: HttpClient;

  constructor(baseUrl: string, model: string, http: HttpClient) {
    this.baseUrl = normalizeBaseUrl(baseUrl || "http://localhost:11434");
    this.model = model.trim() || "nomic-embed-text";
    this.http = http;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const response = await this.http({
      url: `${this.baseUrl}/api/embed`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        input: texts,
      }),
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        `Ollama API error (${response.status}): ${response.text || "Unknown error"}`
      );
    }

    const data = response.json as { embeddings?: number[][] } | null;
    if (!data || !Array.isArray(data.embeddings) || data.embeddings.length !== texts.length) {
      throw new Error("Unerwartete Antwort von Ollama /api/embed.");
    }

    return data.embeddings;
  }
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly id: EmbeddingProviderType = "openai";
  readonly model: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly http: HttpClient;

  constructor(baseUrl: string, apiKey: string, model: string, http: HttpClient) {
    this.baseUrl = normalizeBaseUrl(baseUrl || "https://api.openai.com/v1");
    this.apiKey = apiKey.trim();
    this.model = model.trim() || "text-embedding-3-small";
    this.http = http;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const response = await this.http({
      url: `${this.baseUrl}/embeddings`,
      method: "POST",
      headers,
      body: JSON.stringify({
        model: this.model,
        input: texts,
      }),
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        `OpenAI API error (${response.status}): ${response.text || "Unknown error"}`
      );
    }

    const data = response.json as {
      data?: Array<{ index: number; embedding: number[] }>;
    } | null;

    if (!data || !Array.isArray(data.data) || data.data.length !== texts.length) {
      throw new Error("Unerwartete Antwort vom Embedding-Endpunkt (/embeddings).");
    }

    return data.data
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);
  }
}

export function getActiveProfile(
  settings: SemanticSearchSettings
): { type: "ollama" | "openai"; baseUrl: string; apiKey: string; model: string } {
  const profiles = settings.profiles ?? [];
  const active =
    profiles.find((p) => p.id === settings.activeProfileId) ?? profiles[0];
  if (active) {
    return active;
  }

  if (settings.provider === "openai") {
    return {
      type: "openai",
      baseUrl: settings.openaiBaseUrl,
      apiKey: settings.openaiApiKey,
      model: settings.openaiModel,
    };
  }
  return {
    type: "ollama",
    baseUrl: settings.ollamaUrl,
    apiKey: "",
    model: settings.ollamaModel,
  };
}

export function createEmbeddingProvider(
  settings: SemanticSearchSettings,
  http: HttpClient
): EmbeddingProvider {
  const active = getActiveProfile(settings);
  if (active.type === "openai") {
    return new OpenAIEmbeddingProvider(
      active.baseUrl,
      active.apiKey,
      active.model,
      http
    );
  }

  return new OllamaEmbeddingProvider(active.baseUrl, active.model, http);
}
