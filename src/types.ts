export type EmbeddingProviderType = "ollama" | "openai";

export interface EmbeddingProfile {
  id: string;
  name: string;
  type: EmbeddingProviderType;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface SemanticSearchSettings {
  provider: EmbeddingProviderType;
  ollamaUrl: string;
  ollamaModel: string;
  openaiBaseUrl: string;
  openaiApiKey: string;
  openaiModel: string;
  profiles: EmbeddingProfile[];
  activeProfileId: string;
  autoIndex: boolean;
  excludedFolders: string[];
  maxChunkChars: number;
  chunkOverlapChars: number;
  maxResults: number;
  minSimilarity: number;
  indexingConcurrency: number;
  embeddingBatchSize: number;
  hybridSearchEnabled: boolean;
  hybridKeywordWeight: number;
  showMatchScore: boolean;
}

export const DEFAULT_PROFILES: EmbeddingProfile[] = [
  {
    id: "ollama-default",
    name: "Ollama (Local)",
    type: "ollama",
    baseUrl: "http://localhost:11434",
    apiKey: "",
    model: "nomic-embed-text",
  },
  {
    id: "openai-default",
    name: "OpenAI",
    type: "openai",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "text-embedding-3-small",
  },
];

export const DEFAULT_SETTINGS: SemanticSearchSettings = {
  provider: "ollama",
  ollamaUrl: "http://localhost:11434",
  ollamaModel: "nomic-embed-text",
  openaiBaseUrl: "https://api.openai.com/v1",
  openaiApiKey: "",
  openaiModel: "text-embedding-3-small",
  profiles: DEFAULT_PROFILES,
  activeProfileId: "ollama-default",
  autoIndex: true,
  excludedFolders: [".obsidian", "Templates"],
  maxChunkChars: 1200,
  chunkOverlapChars: 150,
  maxResults: 15,
  minSimilarity: 0.25,
  indexingConcurrency: 4,
  embeddingBatchSize: 16,
  hybridSearchEnabled: true,
  hybridKeywordWeight: 0.3,
  showMatchScore: false,
};

export interface NoteChunk {
  id: string;
  path: string;
  title: string;
  heading: string;
  chunkIndex: number;
  startLine: number;
  content: string;
}

export interface StoredChunk extends NoteChunk {
  embedding: number[];
}

export interface IndexedFileMeta {
  path: string;
  mtime: number;
  contentHash: string;
  chunkIds: string[];
}

export interface IndexData {
  version: number;
  provider: EmbeddingProviderType;
  model: string;
  dimensions: number;
  files: Record<string, IndexedFileMeta>;
  chunks: StoredChunk[];
}

export interface SearchResult {
  path: string;
  title: string;
  heading: string;
  snippet: string;
  startLine: number;
  score: number;
}

export interface EmbeddingProvider {
  readonly id: EmbeddingProviderType;
  readonly model: string;
  embed(texts: string[]): Promise<number[][]>;
}

export interface HttpResponse {
  status: number;
  json: unknown;
  text: string;
}

export interface HttpRequest {
  url: string;
  method: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
}

export type HttpClient = (req: HttpRequest) => Promise<HttpResponse>;
