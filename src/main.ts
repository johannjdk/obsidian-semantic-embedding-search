import { Notice, Plugin, TFile, normalizePath, requestUrl } from "obsidian";
import { t } from "./i18n";
import { VaultIndexer } from "./indexer";
import {
  createEmbeddingProvider,
  getActiveProfile,
} from "./providers/embeddingProvider";
import {
  DEFAULT_PROFILES,
  DEFAULT_SETTINGS,
  type HttpClient,
  type SearchResult,
  type SemanticSearchSettings,
} from "./types";
import { SemanticSearchModal } from "./ui/searchModal";
import { SemanticSearchSettingTab } from "./ui/settingsTab";
import {
  RELATED_NOTES_VIEW_TYPE,
  RelatedNotesView,
} from "./ui/relatedNotesView";
import { VectorStore } from "./vectorStore";

const INDEX_FILENAME = "embeddings-index.json";

const obsidianHttpClient: HttpClient = async (req) => {
  const res = await requestUrl({
    url: req.url,
    method: req.method,
    headers: req.headers,
    body: req.body,
    throw: false,
  });

  return {
    status: res.status,
    json: res.json,
    text: res.text,
  };
};

export default class SemanticEmbeddingSearchPlugin extends Plugin {
  settings: SemanticSearchSettings = { ...DEFAULT_SETTINGS };
  private store!: VectorStore;
  private indexer!: VaultIndexer;
  private statusBarEl: HTMLElement | null = null;
  private pendingFileTimers = new Map<string, number>();

  async onload(): Promise<void> {
    await this.loadSettings();

    const activeModel = this.getActiveModelName();
    this.store = await this.loadIndexStore(this.settings.provider, activeModel);
    this.indexer = new VaultIndexer(this.app.vault, this.store);

    this.statusBarEl = this.addStatusBarItem();
    this.updateStatusBar();

    this.addRibbonIcon("search", t("cmd_open_search"), () => {
      this.openSearchModal();
    });

    this.addCommand({
      id: "open-semantic-search",
      name: t("cmd_open_search"),
      callback: () => this.openSearchModal(),
    });

    this.addCommand({
      id: "find-similar-notes",
      name: t("cmd_find_similar"),
      checkCallback: (checking) => {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile || activeFile.extension !== "md") {
          return false;
        }
        if (!checking) {
          void this.openSimilarNotesForFile(activeFile);
        }
        return true;
      },
    });

    this.addCommand({
      id: "sync-semantic-index",
      name: t("cmd_update_index"),
      callback: () => void this.runIndex(false),
    });

    this.addCommand({
      id: "rebuild-semantic-index",
      name: t("cmd_rebuild_index"),
      callback: () => void this.runIndex(true),
    });

    this.registerView(
      RELATED_NOTES_VIEW_TYPE,
      (leaf) =>
        new RelatedNotesView(leaf, {
          findSimilarForFile: (file) => this.findSimilarForFile(file),
          showMatchScore: () => this.settings.showMatchScore ?? false,
        })
    );

    this.addCommand({
      id: "open-related-notes-sidebar",
      name: t("cmd_open_related_sidebar"),
      callback: () => void this.activateRelatedNotesView(),
    });

    this.addSettingTab(
      new SemanticSearchSettingTab(this.app, this, {
        settings: this.settings,
        saveSettings: () => this.saveSettings(),
        onProfileChanged: () => this.onProfileChanged(),
        testConnection: () => this.testConnection(),
        getIndexStats: () => this.store.getStats(),
        runIndex: (forceRebuild) => this.runIndex(forceRebuild),
        cancelIndex: () => this.cancelIndex(),
        isIndexing: () => this.indexer.indexing,
        clearIndex: () => this.clearIndex(),
      })
    );

    this.registerVaultEvents();
  }

  onunload(): void {
    for (const timer of this.pendingFileTimers.values()) {
      window.clearTimeout(timer);
    }
    this.pendingFileTimers.clear();
  }

  private getActiveModelName(): string {
    return getActiveProfile(this.settings).model;
  }

  private getIndexFilePath(): string {
    const baseDir = this.manifest.dir ?? `${this.app.vault.configDir}/plugins/${this.manifest.id}`;
    const profileId = (this.settings?.activeProfileId || "default").replace(
      /[^a-zA-Z0-9_-]/g,
      "_"
    );
    return normalizePath(`${baseDir}/embeddings-index-${profileId}.json`);
  }

  async onProfileChanged(): Promise<void> {
    const active = getActiveProfile(this.settings);
    await this.loadIndexStore(active.type, active.model);
    this.updateStatusBar();
  }

  private async loadIndexStore(
    provider: SemanticSearchSettings["provider"],
    model: string
  ): Promise<VectorStore> {
    const indexPath = this.getIndexFilePath();
    try {
      const exists = await this.app.vault.adapter.exists(indexPath);
      if (exists) {
        const raw = await this.app.vault.adapter.read(indexPath);
        return VectorStore.deserialize(raw, provider, model);
      }
    } catch (error) {
      console.error("Failed to load semantic search index:", error);
    }
    return new VectorStore(provider, model);
  }

  private async saveIndexStore(): Promise<void> {
    const indexPath = this.getIndexFilePath();
    const dir = indexPath.slice(0, indexPath.lastIndexOf("/"));
    try {
      if (dir && !(await this.app.vault.adapter.exists(dir))) {
        await this.app.vault.adapter.mkdir(dir);
      }
      await this.app.vault.adapter.write(indexPath, this.store.serialize());
    } catch (error) {
      console.error("Failed to save semantic search index:", error);
    }
  }

  async loadSettings(): Promise<void> {
    const loaded = (await this.loadData()) as Partial<SemanticSearchSettings> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded ?? {});
    if (!Array.isArray(this.settings.profiles) || this.settings.profiles.length === 0) {
      this.settings.profiles = DEFAULT_PROFILES.map((p) => ({ ...p }));
      this.settings.activeProfileId =
        this.settings.provider === "openai" ? "openai-default" : "ollama-default";
    }
    if (!this.settings.profiles.some((p) => p.id === this.settings.activeProfileId)) {
      this.settings.activeProfileId = this.settings.profiles[0].id;
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private updateStatusBar(progressText?: string): void {
    if (!this.statusBarEl) return;
    if (progressText) {
      this.statusBarEl.setText(progressText);
      return;
    }
    const { fileCount } = this.store.getStats();
    this.statusBarEl.setText(
      fileCount > 0
        ? t("status_embeddings_count", { count: fileCount })
        : t("status_embeddings_empty")
    );
  }

  private openSearchModal(options: { initialQuery?: string; excludePath?: string } = {}): void {
    new SemanticSearchModal(
      this.app,
      {
        search: (query, excludePath) => this.searchNotes(query, excludePath),
        getIndexedCount: () => {
          const stats = this.store.getStats();
          return { fileCount: stats.fileCount, chunkCount: stats.chunkCount };
        },
        triggerIndex: () => this.runIndex(false),
      },
      options
    ).open();
  }

  private async buildQueryForFile(file: TFile): Promise<string> {
    const content = await this.app.vault.cachedRead(file);
    const bodyPreview = content
      .replace(/^---[\s\S]*?---\s*/, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 600);
    return `${file.basename}: ${bodyPreview}`.trim();
  }

  private async openSimilarNotesForFile(file: TFile): Promise<void> {
    const query = await this.buildQueryForFile(file);
    this.openSearchModal({ initialQuery: query, excludePath: file.path });
  }

  private async findSimilarForFile(file: TFile): Promise<SearchResult[]> {
    const query = await this.buildQueryForFile(file);
    return this.searchNotes(query, file.path);
  }

  private async activateRelatedNotesView(): Promise<void> {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(RELATED_NOTES_VIEW_TYPE)[0];
    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (!rightLeaf) return;
      leaf = rightLeaf;
      await leaf.setViewState({
        type: RELATED_NOTES_VIEW_TYPE,
        active: true,
      });
    }
    workspace.revealLeaf(leaf);
  }

  private parseSearchQuery(rawQuery: string): {
    cleanQuery: string;
    pathFilters: string[];
    tagFilters: string[];
  } {
    const pathFilters: string[] = [];
    const tagFilters: string[] = [];
    const remaining: string[] = [];

    for (const token of rawQuery.split(/\s+/)) {
      if (token.toLowerCase().startsWith("path:") && token.length > 5) {
        pathFilters.push(token.slice(5));
      } else if (token.startsWith("#") && token.length > 1) {
        tagFilters.push(token);
      } else if (token) {
        remaining.push(token);
      }
    }

    const cleanQuery = remaining.join(" ").trim() || rawQuery.trim();
    return { cleanQuery, pathFilters, tagFilters };
  }

  async searchNotes(query: string, excludePath?: string): Promise<SearchResult[]> {
    const provider = createEmbeddingProvider(this.settings, obsidianHttpClient);

    if (!this.store.isCompatibleWith(provider.id, provider.model)) {
      throw new Error(
        t("error_incompatible_index", {
          indexModel: this.store.getStats().model,
          activeModel: provider.model,
        })
      );
    }

    const { cleanQuery, pathFilters, tagFilters } = this.parseSearchQuery(query);
    const [queryEmbedding] = await provider.embed([cleanQuery]);
    return this.store.search(queryEmbedding, {
      maxResults: this.settings.maxResults,
      minSimilarity: this.settings.minSimilarity,
      excludePath,
      queryText: cleanQuery,
      keywordWeight: this.settings.hybridSearchEnabled
        ? this.settings.hybridKeywordWeight
        : 0,
      pathFilters,
      tagFilters,
    });
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      const provider = createEmbeddingProvider(this.settings, obsidianHttpClient);
      const [vec] = await provider.embed(["Test connection Obsidian Semantic Search"]);
      return {
        ok: true,
        message: t("connection_success", {
          provider: provider.id,
          model: provider.model,
          dims: vec.length,
        }),
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        message: t("connection_failed", { message: msg }),
      };
    }
  }

  async runIndex(forceRebuild: boolean): Promise<void> {
    if (this.indexer.indexing) {
      new Notice(t("notice_indexing_running"));
      return;
    }

    const provider = createEmbeddingProvider(this.settings, obsidianHttpClient);
    new Notice(
      forceRebuild
        ? t("notice_indexing_rebuilding")
        : t("notice_indexing_updating")
    );

    try {
      const result = await this.indexer.syncAll(provider, this.settings, {
        forceRebuild,
        onProgress: ({ processedFiles, totalFiles }) => {
          this.updateStatusBar(
            t("status_indexing_progress", {
              processed: processedFiles,
              total: totalFiles,
            })
          );
        },
      });

      await this.saveIndexStore();
      this.updateStatusBar();

      const failedPart =
        result.failedFiles > 0
          ? t("notice_indexing_failed_part", { failed: result.failedFiles })
          : "";
      const prefix = result.aborted
        ? t("notice_indexing_cancelled")
        : t("notice_indexing_complete");

      new Notice(
        t("notice_indexing_summary", {
          prefix,
          indexed: result.indexedFiles,
          skipped: result.skippedFiles,
          removed: result.removedFiles,
          failedPart,
        })
      );
    } catch (error) {
      this.updateStatusBar();
      const msg = error instanceof Error ? error.message : String(error);
      new Notice(t("notice_indexing_error", { message: msg }));
    }
  }

  cancelIndex(): void {
    if (this.indexer.indexing) {
      this.indexer.abort();
      new Notice(t("notice_cancelling"));
    }
  }

  async clearIndex(): Promise<void> {
    const active = getActiveProfile(this.settings);
    this.store.clear(active.type, active.model);
    await this.saveIndexStore();
    this.updateStatusBar();
    new Notice(t("notice_index_cleared"));
  }

  private registerVaultEvents(): void {
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        const activeFile = this.app.workspace.getActiveFile();
        for (const leaf of this.app.workspace.getLeavesOfType(RELATED_NOTES_VIEW_TYPE)) {
          if (leaf.view instanceof RelatedNotesView) {
            void leaf.view.updateForFile(activeFile);
          }
        }
      })
    );

    const scheduleFileIndex = (file: TFile) => {
      if (!this.settings.autoIndex || file.extension !== "md") return;

      const existingTimer = this.pendingFileTimers.get(file.path);
      if (existingTimer !== undefined) {
        window.clearTimeout(existingTimer);
      }

      const timer = window.setTimeout(async () => {
        this.pendingFileTimers.delete(file.path);
        try {
          const provider = createEmbeddingProvider(this.settings, obsidianHttpClient);
          const updated = await this.indexer.indexSingleFile(file, provider, this.settings);
          if (updated) {
            await this.saveIndexStore();
            this.updateStatusBar();
          }
        } catch (error) {
          console.error(`Auto-index failed for ${file.path}:`, error);
        }
      }, 2000);

      this.pendingFileTimers.set(file.path, timer);
    };

    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof TFile) scheduleFileIndex(file);
      })
    );

    this.registerEvent(
      this.app.vault.on("create", (file) => {
        if (file instanceof TFile) scheduleFileIndex(file);
      })
    );

    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (!(file instanceof TFile) || file.extension !== "md") return;
        this.store.removeFile(file.path);
        void this.saveIndexStore();
        this.updateStatusBar();
      })
    );

    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (!(file instanceof TFile) || file.extension !== "md") return;
        this.store.renameFile(oldPath, file.path, file.basename);
        void this.saveIndexStore();
        this.updateStatusBar();
      })
    );
  }
}
