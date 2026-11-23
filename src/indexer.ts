import type { TFile, Vault } from "obsidian";
import { chunkMarkdown, hashContent } from "./chunker";
import type {
  EmbeddingProvider,
  NoteChunk,
  SemanticSearchSettings,
  StoredChunk,
} from "./types";
import type { VectorStore } from "./vectorStore";

const BATCH_SIZE = 16;

export interface IndexProgress {
  processedFiles: number;
  totalFiles: number;
  embeddedChunks: number;
}

export interface IndexSyncResult {
  indexedFiles: number;
  removedFiles: number;
  skippedFiles: number;
  failedFiles: number;
  embeddedChunks: number;
  rebuilt: boolean;
  aborted: boolean;
}

export function isPathExcluded(path: string, excludedFolders: string[]): boolean {
  const normalizedPath = path.replace(/^\/+/, "").toLowerCase();
  for (const folder of excludedFolders) {
    const clean = folder.trim().replace(/^\/+|\/+$/g, "").toLowerCase();
    if (!clean) continue;
    if (normalizedPath === clean || normalizedPath.startsWith(`${clean}/`)) {
      return true;
    }
  }
  return false;
}

export class VaultIndexer {
  private readonly vault: Vault;
  private readonly store: VectorStore;
  private isRunning = false;
  private abortRequested = false;

  constructor(vault: Vault, store: VectorStore) {
    this.vault = vault;
    this.store = store;
  }

  get indexing(): boolean {
    return this.isRunning;
  }

  abort(): void {
    if (this.isRunning) {
      this.abortRequested = true;
    }
  }

  async syncAll(
    provider: EmbeddingProvider,
    settings: SemanticSearchSettings,
    options: {
      forceRebuild?: boolean;
      onProgress?: (progress: IndexProgress) => void;
    } = {}
  ): Promise<IndexSyncResult> {
    if (this.isRunning) {
      throw new Error("Indexing is already in progress.");
    }

    this.isRunning = true;
    this.abortRequested = false;
    let rebuilt = false;

    try {
      const compatible = this.store.isCompatibleWith(provider.id, provider.model);
      if (options.forceRebuild || !compatible) {
        this.store.clear(provider.id, provider.model);
        rebuilt = true;
      } else {
        this.store.setModelMetadata(provider.id, provider.model);
      }

      const allFiles = this.vault
        .getMarkdownFiles()
        .filter((file) => !isPathExcluded(file.path, settings.excludedFolders));

      const activePaths = new Set(allFiles.map((f) => f.path));
      let removedFiles = 0;

      for (const indexedPath of this.store.getAllIndexedPaths()) {
        if (!activePaths.has(indexedPath)) {
          this.store.removeFile(indexedPath);
          removedFiles++;
        }
      }

      let indexedFiles = 0;
      let skippedFiles = 0;
      let failedFiles = 0;
      let embeddedChunks = 0;
      let processedFiles = 0;
      const totalFiles = allFiles.length;
      const concurrency = Math.max(1, Math.floor(settings.indexingConcurrency || 1));
      const batchSize = Math.max(1, Math.floor(settings.embeddingBatchSize || BATCH_SIZE));

      interface PendingFile {
        file: TFile;
        mtime: number;
        contentHash: string;
        totalChunks: number;
        storedChunks: StoredChunk[];
        failed: boolean;
      }

      interface ChunkTask {
        pendingFile: PendingFile;
        chunk: NoteChunk;
      }

      const chunkTasks: ChunkTask[] = [];

      for (const file of allFiles) {
        if (this.abortRequested) break;
        try {
          const existingMeta = this.store.getFileMeta(file.path);
          const mtime = file.stat.mtime;

          if (existingMeta && existingMeta.mtime === mtime) {
            skippedFiles++;
            processedFiles++;
            options.onProgress?.({ processedFiles, totalFiles, embeddedChunks });
            continue;
          }

          const content = await this.vault.cachedRead(file);
          const contentHash = hashContent(content);

          if (existingMeta && existingMeta.contentHash === contentHash) {
            existingMeta.mtime = mtime;
            skippedFiles++;
            processedFiles++;
            options.onProgress?.({ processedFiles, totalFiles, embeddedChunks });
            continue;
          }

          const chunks = chunkMarkdown(file.path, file.basename, content, {
            maxChunkChars: settings.maxChunkChars,
            chunkOverlapChars: settings.chunkOverlapChars,
          });

          if (chunks.length === 0) {
            this.store.upsertFile({ path: file.path, mtime, contentHash, chunkIds: [] }, []);
            indexedFiles++;
            processedFiles++;
            options.onProgress?.({ processedFiles, totalFiles, embeddedChunks });
            continue;
          }

          const pendingFile: PendingFile = {
            file,
            mtime,
            contentHash,
            totalChunks: chunks.length,
            storedChunks: [],
            failed: false,
          };

          for (const chunk of chunks) {
            chunkTasks.push({ pendingFile, chunk });
          }
        } catch (error) {
          failedFiles++;
          processedFiles++;
          console.error(`Failed to prepare ${file.path}:`, error);
          options.onProgress?.({ processedFiles, totalFiles, embeddedChunks });
        }
      }

      const batches: ChunkTask[][] = [];
      for (let i = 0; i < chunkTasks.length; i += batchSize) {
        batches.push(chunkTasks.slice(i, i + batchSize));
      }

      let nextBatchIndex = 0;

      const worker = async (): Promise<void> => {
        while (!this.abortRequested && nextBatchIndex < batches.length) {
          const batch = batches[nextBatchIndex++];
          try {
            const embeddings = await provider.embed(batch.map((t) => t.chunk.content));
            for (let j = 0; j < batch.length; j++) {
              const { pendingFile, chunk } = batch[j];
              if (pendingFile.failed) continue;
              pendingFile.storedChunks.push({
                ...chunk,
                embedding: embeddings[j] ?? [],
              });
              embeddedChunks++;

              if (pendingFile.storedChunks.length === pendingFile.totalChunks) {
                pendingFile.storedChunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
                this.store.upsertFile(
                  {
                    path: pendingFile.file.path,
                    mtime: pendingFile.mtime,
                    contentHash: pendingFile.contentHash,
                    chunkIds: pendingFile.storedChunks.map((c) => c.id),
                  },
                  pendingFile.storedChunks
                );
                indexedFiles++;
                processedFiles++;
                options.onProgress?.({ processedFiles, totalFiles, embeddedChunks });
              }
            }
          } catch (error) {
            console.error("Failed to embed batch:", error);
            for (const { pendingFile } of batch) {
              if (!pendingFile.failed) {
                pendingFile.failed = true;
                failedFiles++;
                processedFiles++;
              }
            }
            options.onProgress?.({ processedFiles, totalFiles, embeddedChunks });
          }
        }
      };

      const workerCount = Math.min(concurrency, batches.length);
      if (workerCount > 0) {
        await Promise.all(Array.from({ length: workerCount }, () => worker()));
      }

      return {
        indexedFiles,
        removedFiles,
        skippedFiles,
        failedFiles,
        embeddedChunks,
        rebuilt,
        aborted: this.abortRequested,
      };
    } finally {
      this.isRunning = false;
      this.abortRequested = false;
    }
  }

  async indexSingleFile(
    file: TFile,
    provider: EmbeddingProvider,
    settings: SemanticSearchSettings
  ): Promise<boolean> {
    if (this.isRunning) {
      return false;
    }

    if (isPathExcluded(file.path, settings.excludedFolders)) {
      this.store.removeFile(file.path);
      return true;
    }

    if (!this.store.isCompatibleWith(provider.id, provider.model)) {
      return false;
    }

    const result = await this.indexFileInternal(file, provider, settings);
    return result >= 0;
  }
private async indexFileInternal(
    file: TFile,
    provider: EmbeddingProvider,
    settings: SemanticSearchSettings
  ): Promise<number> {
    const existing = this.store.getFileMeta(file.path);
    if (existing && existing.mtime === file.stat.mtime) {
      return -1;
    }

    const content = await this.vault.cachedRead(file);
    const contentHash = hashContent(content);

    if (existing && existing.contentHash === contentHash) {
      existing.mtime = file.stat.mtime;
      return -1;
    }

    const chunks = chunkMarkdown(file.path, file.basename, content, {
      maxChunkChars: settings.maxChunkChars,
      chunkOverlapChars: settings.chunkOverlapChars,
    });

    if (chunks.length === 0) {
      this.store.upsertFile(
        {
          path: file.path,
          mtime: file.stat.mtime,
          contentHash,
          chunkIds: [],
        },
        []
      );
      return 0;
    }

    const batchSize = Math.max(1, Math.floor(settings.embeddingBatchSize || BATCH_SIZE));
    const storedChunks = await this.embedChunksInBatches(chunks, provider, batchSize);
    this.store.upsertFile(
      {
        path: file.path,
        mtime: file.stat.mtime,
        contentHash,
        chunkIds: storedChunks.map((c) => c.id),
      },
      storedChunks
    );

    return storedChunks.length;
  }

  private async embedChunksInBatches(
    chunks: NoteChunk[],
    provider: EmbeddingProvider,
    batchSize: number = BATCH_SIZE
  ): Promise<StoredChunk[]> {
    const stored: StoredChunk[] = [];

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const embeddings = await provider.embed(batch.map((c) => c.content));

      for (let j = 0; j < batch.length; j++) {
        stored.push({
          ...batch[j],
          embedding: embeddings[j],
        });
      }
    }

    return stored;
  }
}
