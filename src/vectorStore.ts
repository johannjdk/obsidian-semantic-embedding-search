import type {
  EmbeddingProviderType,
  IndexData,
  IndexedFileMeta,
  SearchResult,
  StoredChunk,
} from "./types";

export const INDEX_VERSION = 1;
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const va = a[i];
    const vb = b[i];
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) {
    return 0;
  }

  return dot / denom;
}
function buildSnippet(chunk: StoredChunk, maxLen = 180): string {
  const lines = chunk.content.split("\n");
  const body = lines.length > 1 ? lines.slice(1).join(" ") : chunk.content;
  const normalized = body.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLen) {
    return normalized;
  }
  return normalized.slice(0, maxLen - 1).trimEnd() + "…";
}

export class VectorStore {
  private data: IndexData;

  constructor(provider: EmbeddingProviderType, model: string, initial?: IndexData) {
    if (initial && initial.version === INDEX_VERSION) {
      this.data = initial;
      this.pruneCorruptedEntries();
    } else {
      this.data = {
        version: INDEX_VERSION,
        provider,
        model,
        dimensions: 0,
        files: {},
        chunks: [],
      };
    }
  }

  private pruneCorruptedEntries(): void {
    const validChunks: StoredChunk[] = [];
    const chunkIdsByPath = new Map<string, Set<string>>();

    for (const chunk of this.data.chunks) {
      if (!this.data.files[chunk.path]) {
        continue;
      }
      validChunks.push(chunk);
      let ids = chunkIdsByPath.get(chunk.path);
      if (!ids) {
        ids = new Set<string>();
        chunkIdsByPath.set(chunk.path, ids);
      }
      ids.add(chunk.id);
    }

    const removedPaths = new Set<string>();
    for (const [path, meta] of Object.entries(this.data.files)) {
      if (meta.chunkIds.length === 0) continue;
      const validIds = chunkIdsByPath.get(path);
      if (!validIds || meta.chunkIds.some((id) => !validIds.has(id))) {
        delete this.data.files[path];
        removedPaths.add(path);
      }
    }

    if (removedPaths.size > 0 || validChunks.length !== this.data.chunks.length) {
      this.data.chunks =
        removedPaths.size > 0
          ? validChunks.filter((chunk) => !removedPaths.has(chunk.path))
          : validChunks;
    }
  }

  getData(): IndexData {
    return this.data;
  }

  getStats(): { fileCount: number; chunkCount: number; provider: EmbeddingProviderType; model: string; dimensions: number } {
    return {
      fileCount: Object.keys(this.data.files).length,
      chunkCount: this.data.chunks.length,
      provider: this.data.provider,
      model: this.data.model,
      dimensions: this.data.dimensions,
    };
  }

  getFileMeta(path: string): IndexedFileMeta | undefined {
    return this.data.files[path];
  }

  getAllIndexedPaths(): string[] {
    return Object.keys(this.data.files);
  }

  isCompatibleWith(provider: EmbeddingProviderType, model: string): boolean {
    if (this.data.chunks.length === 0) return true;
    return this.data.provider === provider && this.data.model === model;
  }

  setModelMetadata(provider: EmbeddingProviderType, model: string): void {
    this.data.provider = provider;
    this.data.model = model;
  }

  clear(provider: EmbeddingProviderType, model: string): void {
    this.data = {
      version: INDEX_VERSION,
      provider,
      model,
      dimensions: 0,
      files: {},
      chunks: [],
    };
  }

  upsertFile(meta: IndexedFileMeta, newChunks: StoredChunk[]): void {
    this.removeFile(meta.path);

    if (newChunks.length > 0 && this.data.dimensions === 0) {
      this.data.dimensions = newChunks[0].embedding.length;
    }

    this.data.files[meta.path] = meta;
    this.data.chunks.push(...newChunks);
  }

  removeFile(path: string): void {
    if (!this.data.files[path]) {
      return;
    }
    delete this.data.files[path];
    this.data.chunks = this.data.chunks.filter((chunk) => chunk.path !== path);
  }

  renameFile(oldPath: string, newPath: string, newTitle: string): void {
    const existing = this.data.files[oldPath];
    if (!existing) {
      return;
    }

    delete this.data.files[oldPath];
    const updatedChunkIds: string[] = [];

    for (const chunk of this.data.chunks) {
      if (chunk.path === oldPath) {
        chunk.path = newPath;
        chunk.title = newTitle;
        chunk.id = `${newPath}#${chunk.chunkIndex}`;
        updatedChunkIds.push(chunk.id);
      }
    }

    this.data.files[newPath] = {
      ...existing,
      path: newPath,
      chunkIds: updatedChunkIds,
    };
  }

  private computeKeywordScore(queryTerms: string[], chunk: StoredChunk): number {
  if (queryTerms.length === 0) return 0;
  const titleLower = chunk.title.toLowerCase();
  const headingLower = chunk.heading.toLowerCase();
  const contentLower = chunk.content.toLowerCase();

  let matched = 0;
  for (const term of queryTerms) {
    if (titleLower.includes(term) || headingLower.includes(term)) {
      matched += 1.25;
    } else if (contentLower.includes(term)) {
      matched += 1;
    }
  }
  return Math.min(1, matched / queryTerms.length);
}
search(
    queryEmbedding: number[],
    options: {
      maxResults: number;
      minSimilarity: number;
      excludePath?: string;
      queryText?: string;
      keywordWeight?: number;
      pathFilters?: string[];
      tagFilters?: string[];
    }
  ): SearchResult[] {
    if (queryEmbedding.length === 0 || this.data.chunks.length === 0) {
      return [];
    }

    const keywordWeight = Math.max(0, Math.min(1, options.keywordWeight ?? 0));
    const queryTerms =
      keywordWeight > 0 && options.queryText
        ? options.queryText
            .toLowerCase()
            .split(/\s+/)
            .map((t) => t.trim())
            .filter((t) => t.length >= 2)
        : [];
    const useHybrid = keywordWeight > 0 && queryTerms.length > 0;

    const pathFilters = (options.pathFilters ?? []).map((p) => p.toLowerCase()).filter(Boolean);
    const tagFilters = (options.tagFilters ?? []).map((t) => t.toLowerCase()).filter(Boolean);

    const bestByPath = new Map<string, SearchResult>();

    for (const chunk of this.data.chunks) {
      if (options.excludePath && chunk.path === options.excludePath) {
        continue;
      }
      if (pathFilters.length > 0) {
        const lowerPath = chunk.path.toLowerCase();
        if (!pathFilters.every((pf) => lowerPath.includes(pf))) {
          continue;
        }
      }
      if (tagFilters.length > 0) {
        const lowerContent = chunk.content.toLowerCase();
        if (!tagFilters.every((tf) => lowerContent.includes(tf))) {
          continue;
        }
      }

      const semanticScore = cosineSimilarity(queryEmbedding, chunk.embedding);
      const score = useHybrid
        ? (1 - keywordWeight) * semanticScore +
          keywordWeight * this.computeKeywordScore(queryTerms, chunk)
        : semanticScore;

      if (score < options.minSimilarity) {
        continue;
      }

      const existing = bestByPath.get(chunk.path);
      if (!existing || score > existing.score) {
        bestByPath.set(chunk.path, {
          path: chunk.path,
          title: chunk.title,
          heading: chunk.heading,
          snippet: buildSnippet(chunk),
          startLine: chunk.startLine,
          score,
        });
      }
    }

    return Array.from(bestByPath.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, options.maxResults));
  }

  serialize(): string {
    return JSON.stringify(this.data);
  }

  static deserialize(
    raw: string,
    fallbackProvider: EmbeddingProviderType,
    fallbackModel: string
  ): VectorStore {
    try {
      const parsed = JSON.parse(raw) as IndexData;
      if (
        parsed &&
        parsed.version === INDEX_VERSION &&
        typeof parsed.files === "object" &&
        Array.isArray(parsed.chunks)
      ) {
        return new VectorStore(parsed.provider, parsed.model, parsed);
      }
    } catch {
    }
    return new VectorStore(fallbackProvider, fallbackModel);
  }
}
