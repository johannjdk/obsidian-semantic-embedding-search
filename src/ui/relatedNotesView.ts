import { ItemView, Notice, TFile, WorkspaceLeaf, setIcon } from "obsidian";
import { t } from "../i18n";
import type { SearchResult } from "../types";

export const RELATED_NOTES_VIEW_TYPE = "semantic-related-notes-view";

export interface RelatedNotesViewCallbacks {
  findSimilarForFile: (file: TFile) => Promise<SearchResult[]>;
  showMatchScore: () => boolean;
}

export class RelatedNotesView extends ItemView {
  private callbacks: RelatedNotesViewCallbacks;
  private statusEl!: HTMLElement;
  private listEl!: HTMLElement;
  private activeFilePath: string | null = null;
  private requestId = 0;

  constructor(leaf: WorkspaceLeaf, callbacks: RelatedNotesViewCallbacks) {
    super(leaf);
    this.callbacks = callbacks;
  }

  getViewType(): string {
    return RELATED_NOTES_VIEW_TYPE;
  }

  getDisplayText(): string {
    return t("related_title");
  }

  getIcon(): string {
    return "sparkles";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("semantic-related-view");

    const header = container.createDiv({ cls: "semantic-related-header" });
    header.createSpan({ text: t("related_title"), cls: "semantic-related-title" });

    const refreshBtn = header.createEl("button", {
      cls: "clickable-icon semantic-related-refresh",
      attr: { "aria-label": t("related_refresh_aria") },
    });
    setIcon(refreshBtn, "refresh-cw");
    refreshBtn.addEventListener("click", () => {
      void this.updateForFile(this.app.workspace.getActiveFile(), true);
    });

    this.statusEl = container.createDiv({ cls: "semantic-related-status" });
    this.listEl = container.createDiv({ cls: "semantic-related-list" });

    await this.updateForFile(this.app.workspace.getActiveFile(), true);
  }

  async onClose(): Promise<void> {
    this.requestId++;
  }

  async updateForFile(file: TFile | null, force = false): Promise<void> {
    if (!this.statusEl || !this.listEl) return;

    if (!file || file.extension !== "md") {
      this.activeFilePath = null;
      this.statusEl.setText(t("related_open_markdown"));
      this.listEl.empty();
      return;
    }

    if (!force && this.activeFilePath === file.path) {
      return;
    }
    this.activeFilePath = file.path;

    const currentRequest = ++this.requestId;
    this.statusEl.setText(t("related_finding", { title: file.basename }));
    this.listEl.empty();

    try {
      const results = await this.callbacks.findSimilarForFile(file);
      if (currentRequest !== this.requestId) return;

      if (results.length === 0) {
        this.statusEl.setText(t("related_none"));
        return;
      }

      this.statusEl.setText(t("related_count", { count: results.length }));
      for (const result of results) {
        const itemEl = this.listEl.createDiv({
          cls: "semantic-related-item",
          attr: result.snippet ? { title: result.snippet } : undefined,
        });

        const topRow = itemEl.createDiv({ cls: "semantic-related-item-top" });
        topRow.createSpan({ text: result.title, cls: "semantic-related-item-title" });
        if (this.callbacks.showMatchScore()) {
          topRow.createSpan({
            text: `${Math.round(result.score * 100)}%`,
            cls: "semantic-related-item-score",
          });
        }

        const folder = result.path.includes("/")
          ? result.path.slice(0, result.path.lastIndexOf("/"))
          : "";
        const metaParts = [folder, result.heading ? `# ${result.heading}` : ""].filter(Boolean);
        if (metaParts.length > 0) {
          itemEl.createDiv({
            text: metaParts.join(" · "),
            cls: "semantic-related-item-meta",
          });
        }

        itemEl.addEventListener("click", (e) => {
          void this.openResult(result, e.ctrlKey || e.metaKey);
        });
      }
    } catch (error) {
      if (currentRequest !== this.requestId) return;
      const msg = error instanceof Error ? error.message : String(error);
      this.statusEl.setText(`Error: ${msg}`);
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
  }
}
