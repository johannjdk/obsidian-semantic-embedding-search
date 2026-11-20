# Semantic Embedding Search for Obsidian

**Semantic Embedding Search** is a lightweight semantic search and related notes plugin for **Obsidian** (built with **TypeScript**). It uses AI embedding models locally via **Ollama** or through **OpenAI-compatible APIs** (OpenAI, LM Studio, vLLM, etc.) while storing the index directly in your vault's plugin directory.

---

## What It Does

* **Semantic & Hybrid Search:** Search notes by meaning, optionally blended with keyword matching.
* **Search Filters:** Filter results using `path:Folder/` and `#tag`.
* **Related Notes Sidebar:** Automatically shows related notes for the currently open file.
* **Embedding Profiles:** Switch between multiple providers and models (Ollama, OpenAI, LM Studio), each with its own index.
* **Fast Indexing:** Configurable batch size, parallel requests, and cancel support.

---

## Installation & Getting Started

*Prerequisite:* You need an embedding provider, such as **Ollama** running locally or an **OpenAI-compatible API** endpoint.

1. Clone the repository and build the plugin:
   ```bash
   git clone https://github.com/johannjdk/obsidian-semantic-embedding-search.git
   cd obsidian-semantic-embedding-search
   npm install
   npm run build
   ```
2. Copy the contents of `dist/` into your Obsidian vault's plugin folder (`.obsidian/plugins/semantic-embedding-search/`):
   * `dist/main.js`
   * `dist/manifest.json`
   * `dist/styles.css`
3. Enable **Semantic Embedding Search** in Obsidian under **Settings -> Community plugins**.

### Quick Start (Local Ollama)

1. Pull an embedding model:
   ```bash
   ollama pull nomic-embed-text
   ```
2. Open the plugin settings in Obsidian, select **Ollama (Local)**, and click **Test**.
3. Click **Update** to build your initial index.
4. Open the search modal via the ribbon search icon or the command palette (**Open semantic search**), or open the **Related Notes** sidebar.

---

## Development

```bash
npm test       # Run unit tests
npm run dev    # Watch mode (outputs to dist/)
npm run build  # Type-check & production build
```

---

## License

Semantic Embedding Search is licensed under the [MIT License](https://github.com/johannjdk/obsidian-semantic-embedding-search/blob/main/LICENSE).# obsidian-semantic-embedding-search
# obsidian-semantic-embedding-search
