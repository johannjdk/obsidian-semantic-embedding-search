import { App, Modal, Notice, TFile, setIcon } from "obsidian";
import { t } from "../i18n";
import type { SearchResult } from "../types";

export interface SearchModalCallbacks {
  search: (query: string, excludePath?: string) => Promise<SearchResult[]>;
  getIndexedCount: () => { fileCount: number; chunkCount: number };
  triggerIndex: () => Promise<void>;
}

export class SemanticSearchModal extends Modal {
  private readonly callbacks: SearchModalCallbacks;
  private readonly initialQuery: string;
  private readonly excludePath?: string;

  private inputEl!: HTMLInputElement;
  private searchBarEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private resultsEl!: HTMLElement;

  private results: SearchResult[] = [];
  private selectedIndex = 0;
  private debounceTimer: number | null = null;
  private activeRequestId = 0;

  constructor(
    app: App,
    callbacks: SearchModalCallbacks,
    options: { initialQuery?: string; excludePath?: string } = {}
  ) {
    super(app);
    this.callbacks = callbacks;
    this.initialQuery = options.initialQuery ?? "";
    this.excludePath = options.excludePath;
  }

  onOpen(): void {
    const { contentEl, modalEl } = this;
    modalEl.addClass("semantic-search-modal");
    contentEl.empty();

    this.searchBarEl = contentEl.createDiv({ cls: "semantic-search-bar" });
    const iconEl = this.searchBarEl.createSpan({ cls: "semantic-search-icon" });
    setIcon(iconEl, "search");

    this.inputEl = this.searchBarEl.createEl("input", {
      type: "text",
      cls: "semantic-search-input",
      placeholder: t("search_placeholder"),
    });
    this.inputEl.value = this.initialQuery;

    this.statusEl = contentEl.createDiv({ cls: "semantic-search-status" });
    this.resultsEl = contentEl.createDiv({ cls: "semantic-search-results" });

    this.inputEl.addEventListener("input", () => this.scheduleSearch());
    this.inputEl.addEventListener("keydown", (e) => this.handleKeyDown(e));

    this.renderInitialState();
    this.inputEl.focus();

    if (this.initialQuery.trim()) {
      void this.runSearch(this.initialQuery.trim());
    }
  }

  onClose(): void {
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.contentEl.empty();
  }

  private renderInitialState(): void {
    const { fileCount, chunkCount } = this.callbacks.getIndexedCount();
    this.resultsEl.empty();

    if (fileCount === 0) {
      this.statusEl.setText(t("search_empty_status"));
      const emptyBox = this.resultsEl.createDiv({ cls: "semantic-search-empty" });
      emptyBox.createEl("p", {
        text: t("search_empty_desc"),
      });
      const btn = emptyBox.createEl("button", {
        text: t("search_empty_btn"),
        cls: "mod-cta",
      });
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        btn.setText(t("search_empty_btn_running"));
        await this.callbacks.triggerIndex();
        this.renderInitialState();
        if (this.inputEl.value.trim()) {
          void this.runSearch(this.inputEl.value.trim());
        }
      });
      return;
    }

    this.statusEl.setText(
      t("search_ready_status", { files: fileCount, chunks: chunkCount })
    );
  }

  private setLoading(loading: boolean): void {
    this.searchBarEl.toggleClass("semantic-search-loading", loading);
  }

  private scheduleSearch(): void {
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
    }

    const query = this.inputEl.value.trim();
    if (!query) {
      this.setLoading(false);
      this.results = [];
      this.renderInitialState();
      return;
    }

    this.setLoading(true);
    this.statusEl.setText(t("search_searching"));
    this.debounceTimer = window.setTimeout(() => {
      void this.runSearch(query);
    }, 320);
  }

  private async runSearch(query: string): Promise<void> {
    const requestId = ++this.activeRequestId;
    this.setLoading(true);
    this.statusEl.setText(t("search_generating"));

    try {
      const results = await this.callbacks.search(query, this.excludePath);
      if (requestId !== this.activeRequestId) {
        return;
      }

      this.setLoading(false);
      this.results = results;
      this.selectedIndex = 0;
      this.renderResults();
    } catch (error) {
      if (requestId !== this.activeRequestId) {
        return;
      }
      this.setLoading(false);
      const message = error instanceof Error ? error.message : String(error);
      this.statusEl.setText(t("search_error", { message }));
      this.resultsEl.empty();
    }
  }

  private renderResults(): void {
    this.resultsEl.empty();

    if (this.results.length === 0) {
      this.statusEl.setText(t("search_no_results"));
      const emptyEl = this.resultsEl.createDiv({ cls: "semantic-search-empty" });
      emptyEl.setText(t("search_no_results_hint"));
      return;
    }

    this.statusEl.setText(
      t("search_results_count", { count: this.results.length })
    );

    this.results.forEach((result, index) => {
      const itemEl = this.resultsEl.createDiv({
        cls:
          "semantic-search-item" +
          (index === this.selectedIndex ? " is-selected" : ""),
      });

      const headerEl = itemEl.createDiv({ cls: "semantic-search-item-header" });
      const titleGroup = headerEl.createDiv({ cls: "semantic-search-item-title-group" });
      titleGroup.createSpan({
        text: result.title,
        cls: "semantic-search-item-title",
      });

      const folder = result.path.includes("/")
        ? result.path.slice(0, result.path.lastIndexOf("/"))
        : "";
      if (folder) {
        titleGroup.createSpan({
          text: folder,
          cls: "semantic-search-item-folder",
        });
      }

      const scorePercent = Math.round(result.score * 100);
      headerEl.createSpan({
        text: `${scorePercent}%`,
        cls: "semantic-search-item-score",
      });

      if (result.heading) {
        itemEl.createDiv({
          text: `# ${result.heading}`,
          cls: "semantic-search-item-heading",
        });
      }

      itemEl.createDiv({
        text: result.snippet,
        cls: "semantic-search-item-snippet",
      });

      itemEl.addEventListener("mouseenter", () => {
        this.selectedIndex = index;
        this.updateSelectionHighlight();
      });

      itemEl.addEventListener("click", (evt) => {
        void this.openResult(result, evt.ctrlKey || evt.metaKey);
      });
    });
  }

  private updateSelectionHighlight(): void {
    const items = this.resultsEl.querySelectorAll(".semantic-search-item");
    items.forEach((el, idx) => {
      el.classList.toggle("is-selected", idx === this.selectedIndex);
    });
    const active = items[this.selectedIndex] as HTMLElement | undefined;
    active?.scrollIntoView({ block: "nearest" });
  }

  private handleKeyDown(evt: KeyboardEvent): void {
    if (evt.key === "ArrowDown") {
      if (this.results.length > 0) {
        evt.preventDefault();
        this.selectedIndex = (this.selectedIndex + 1) % this.results.length;
        this.updateSelectionHighlight();
      }
    } else if (evt.key === "ArrowUp") {
      if (this.results.length > 0) {
        evt.preventDefault();
        this.selectedIndex =
          (this.selectedIndex - 1 + this.results.length) % this.results.length;
        this.updateSelectionHighlight();
      }
    } else if (evt.key === "Enter") {
      evt.preventDefault();
      const selected = this.results[this.selectedIndex];
      if (selected) {
        void this.openResult(selected, evt.ctrlKey || evt.metaKey);
      } else if (this.inputEl.value.trim()) {
        if (this.debounceTimer !== null) {
          window.clearTimeout(this.debounceTimer);
          this.debounceTimer = null;
        }
        void this.runSearch(this.inputEl.value.trim());
      }
    }
  }

  private async openResult(result: SearchResult, newTab: boolean): Promise<void> {
    const abstractFile = this.app.vault.getAbstractFileByPath(result.path);
    if (!(abstractFile instanceof TFile)) {
      new Notice(t("notice_note_not_found", { path: result.path }));
      return;
    }

    const leaf = this.app.workspace.getLeaf(newTab ? "tab" : false);
    await leaf.openFile(abstractFile, {
      eState: { line: result.startLine },
    });
    this.close();
  }
}
