import { App, Notice, Plugin, PluginSettingTab, Setting } from "obsidian";
import { t } from "../i18n";
import type {
  EmbeddingProfile,
  EmbeddingProviderType,
  SemanticSearchSettings,
} from "../types";

export interface SettingsHost {
  settings: SemanticSearchSettings;
  saveSettings: () => Promise<void>;
  onProfileChanged: () => Promise<void>;
  testConnection: () => Promise<{ ok: boolean; message: string }>;
  getIndexStats: () => {
    fileCount: number;
    chunkCount: number;
    provider: EmbeddingProviderType;
    model: string;
    dimensions: number;
  };
  runIndex: (forceRebuild: boolean) => Promise<void>;
  cancelIndex: () => void;
  isIndexing: () => boolean;
  clearIndex: () => Promise<void>;
}

export class SemanticSearchSettingTab extends PluginSettingTab {
  private readonly host: SettingsHost;

  constructor(app: App, plugin: Plugin, host: SettingsHost) {
    super(app, plugin);
    this.host = host;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: t("settings_title") });

    const profiles = this.host.settings.profiles;
    let activeProfile =
      profiles.find((p) => p.id === this.host.settings.activeProfileId) ??
      profiles[0];

    new Setting(containerEl)
      .setClass("semantic-profile-selector")
      .setName(t("settings_profile_name"))
      .setDesc(t("settings_profile_desc"))
      .addDropdown((dropdown) => {
        for (const profile of profiles) {
          dropdown.addOption(
            profile.id,
            `${profile.name} (${profile.model || profile.type})`
          );
        }
        dropdown
          .setValue(activeProfile.id)
          .onChange(async (value) => {
            this.host.settings.activeProfileId = value;
            await this.host.saveSettings();
            await this.host.onProfileChanged();
            this.display();
          });
      })
      .addButton((button) =>
        button.setButtonText(t("settings_profile_add")).onClick(async () => {
          const newProfile: EmbeddingProfile = {
            id: `profile-${Date.now()}`,
            name: `Custom Provider ${profiles.length + 1}`,
            type: "ollama",
            baseUrl: "http://localhost:11434",
            apiKey: "",
            model: "nomic-embed-text",
          };
          profiles.push(newProfile);
          this.host.settings.activeProfileId = newProfile.id;
          await this.host.saveSettings();
          await this.host.onProfileChanged();
          this.display();
        })
      )
      .addButton((button) =>
        button
          .setButtonText(t("settings_profile_delete"))
          .setWarning()
          .setDisabled(profiles.length <= 1)
          .onClick(async () => {
            if (profiles.length <= 1) return;
            const idx = profiles.findIndex((p) => p.id === activeProfile.id);
            if (idx >= 0) {
              profiles.splice(idx, 1);
            }
            this.host.settings.activeProfileId = profiles[0].id;
            await this.host.saveSettings();
            await this.host.onProfileChanged();
            this.display();
          })
      );

    new Setting(containerEl)
      .setName(t("settings_profile_label"))
      .setDesc(t("settings_profile_label_desc"))
      .addText((text) =>
        text
          .setPlaceholder(t("settings_profile_label_placeholder"))
          .setValue(activeProfile.name)
          .onChange(async (value) => {
            activeProfile.name = value;
            await this.host.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t("settings_provider_type"))
      .setDesc(t("settings_provider_type_desc"))
      .addDropdown((dropdown) =>
        dropdown
          .addOption("ollama", t("settings_provider_ollama"))
          .addOption("openai", t("settings_provider_openai"))
          .setValue(activeProfile.type)
          .onChange(async (value) => {
            activeProfile.type = value as EmbeddingProviderType;
            if (activeProfile.type === "ollama" && activeProfile.baseUrl.includes("openai.com")) {
              activeProfile.baseUrl = "http://localhost:11434";
              activeProfile.model = "nomic-embed-text";
            } else if (activeProfile.type === "openai" && activeProfile.baseUrl.includes("11434")) {
              activeProfile.baseUrl = "https://api.openai.com/v1";
              activeProfile.model = "text-embedding-3-small";
            }
            await this.host.saveSettings();
            this.display();
          })
      );

    new Setting(containerEl)
      .setName(
        activeProfile.type === "ollama"
          ? t("settings_ollama_url")
          : t("settings_api_url")
      )
      .setDesc(
        activeProfile.type === "ollama"
          ? t("settings_ollama_url_desc")
          : t("settings_api_url_desc")
      )
      .addText((text) =>
        text
          .setPlaceholder(
            activeProfile.type === "ollama"
              ? "http://localhost:11434"
              : "https://api.openai.com/v1"
          )
          .setValue(activeProfile.baseUrl)
          .onChange(async (value) => {
            activeProfile.baseUrl = value;
            await this.host.saveSettings();
          })
      );

    if (activeProfile.type === "openai") {
      new Setting(containerEl)
        .setName(t("settings_api_key"))
        .setDesc(t("settings_api_key_desc"))
        .addText((text) => {
          text.inputEl.type = "password";
          text
            .setPlaceholder("sk-...")
            .setValue(activeProfile.apiKey)
            .onChange(async (value) => {
              activeProfile.apiKey = value;
              await this.host.saveSettings();
            });
        });
    }

    new Setting(containerEl)
      .setName(t("settings_model"))
      .setDesc(
        activeProfile.type === "ollama"
          ? t("settings_model_ollama_desc")
          : t("settings_model_openai_desc")
      )
      .addText((text) =>
        text
          .setPlaceholder(
            activeProfile.type === "ollama"
              ? "nomic-embed-text"
              : "text-embedding-3-small"
          )
          .setValue(activeProfile.model)
          .onChange(async (value) => {
            activeProfile.model = value;
            await this.host.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t("settings_test_connection"))
      .setDesc(t("settings_test_connection_desc"))
      .addButton((button) =>
        button.setButtonText(t("settings_test_btn")).onClick(async () => {
          button.setDisabled(true);
          button.setButtonText(t("settings_test_btn_testing"));
          const result = await this.host.testConnection();
          new Notice(result.message);
          button.setDisabled(false);
          button.setButtonText(t("settings_test_btn"));
        })
      );

    containerEl.createEl("h3", { text: t("settings_section_indexing") });

    new Setting(containerEl)
      .setName(t("settings_auto_index"))
      .setDesc(t("settings_auto_index_desc"))
      .addToggle((toggle) =>
        toggle.setValue(this.host.settings.autoIndex).onChange(async (value) => {
          this.host.settings.autoIndex = value;
          await this.host.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName(t("settings_concurrency"))
      .setDesc(t("settings_concurrency_desc"))
      .addSlider((slider) =>
        slider
          .setLimits(1, 20, 1)
          .setValue(this.host.settings.indexingConcurrency ?? 4)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.host.settings.indexingConcurrency = value;
            await this.host.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t("settings_batch_size"))
      .setDesc(t("settings_batch_size_desc"))
      .addSlider((slider) =>
        slider
          .setLimits(1, 64, 1)
          .setValue(this.host.settings.embeddingBatchSize ?? 16)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.host.settings.embeddingBatchSize = value;
            await this.host.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t("settings_excluded_folders"))
      .setDesc(t("settings_excluded_folders_desc"))
      .addText((text) =>
        text
          .setPlaceholder(".obsidian, Templates")
          .setValue(this.host.settings.excludedFolders.join(", "))
          .onChange(async (value) => {
            this.host.settings.excludedFolders = value
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            await this.host.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t("settings_max_results"))
      .setDesc(t("settings_max_results_desc"))
      .addSlider((slider) =>
        slider
          .setLimits(5, 50, 5)
          .setValue(this.host.settings.maxResults)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.host.settings.maxResults = value;
            await this.host.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t("settings_min_similarity"))
      .setDesc(t("settings_min_similarity_desc"))
      .addSlider((slider) =>
        slider
          .setLimits(0, 80, 5)
          .setValue(Math.round(this.host.settings.minSimilarity * 100))
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.host.settings.minSimilarity = value / 100;
            await this.host.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t("settings_show_match_score"))
      .setDesc(t("settings_show_match_score_desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.host.settings.showMatchScore ?? false)
          .onChange(async (value) => {
            this.host.settings.showMatchScore = value;
            await this.host.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t("settings_hybrid_search"))
      .setDesc(t("settings_hybrid_search_desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.host.settings.hybridSearchEnabled ?? true)
          .onChange(async (value) => {
            this.host.settings.hybridSearchEnabled = value;
            await this.host.saveSettings();
            this.display();
          })
      );

    if (this.host.settings.hybridSearchEnabled ?? true) {
      new Setting(containerEl)
        .setName(t("settings_keyword_weight"))
        .setDesc(t("settings_keyword_weight_desc"))
        .addSlider((slider) =>
          slider
            .setLimits(0, 100, 5)
            .setValue(Math.round((this.host.settings.hybridKeywordWeight ?? 0.3) * 100))
            .setDynamicTooltip()
            .onChange(async (value) => {
              this.host.settings.hybridKeywordWeight = value / 100;
              await this.host.saveSettings();
            })
        );
    }

    new Setting(containerEl)
      .setName(t("settings_chunk_size"))
      .setDesc(t("settings_chunk_size_desc"))
      .addText((text) =>
        text
          .setPlaceholder("1200")
          .setValue(String(this.host.settings.maxChunkChars))
          .onChange(async (value) => {
            const parsed = Number.parseInt(value, 10);
            if (!Number.isNaN(parsed) && parsed >= 200) {
              this.host.settings.maxChunkChars = parsed;
              await this.host.saveSettings();
            }
          })
      );

    containerEl.createEl("h3", { text: t("settings_section_status") });

    const stats = this.host.getIndexStats();
    const statsDesc =
      stats.fileCount > 0
        ? t("settings_index_stats", {
            files: stats.fileCount,
            chunks: stats.chunkCount,
            provider: stats.provider,
            model: stats.model,
            dims: stats.dimensions,
          })
        : t("settings_index_empty");

    new Setting(containerEl)
      .setName(t("settings_current_index"))
      .setDesc(statsDesc)
      .addButton((button) =>
        button
          .setButtonText(t("settings_btn_update"))
          .setCta()
          .onClick(async () => {
            button.setDisabled(true);
            await this.host.runIndex(false);
            this.display();
          })
      )
      .addButton((button) =>
        button.setButtonText(t("settings_btn_rebuild")).onClick(async () => {
          button.setDisabled(true);
          await this.host.runIndex(true);
          this.display();
        })
      )
      .addButton((button) =>
        button
          .setButtonText(t("settings_btn_cancel"))
          .setDisabled(!this.host.isIndexing())
          .onClick(() => {
            this.host.cancelIndex();
            button.setDisabled(true);
          })
      )
      .addButton((button) =>
        button
          .setButtonText(t("settings_btn_clear"))
          .setWarning()
          .onClick(async () => {
            await this.host.clearIndex();
            this.display();
          })
      );
  }
}
