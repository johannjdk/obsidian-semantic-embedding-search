export const en = {
  cmd_open_search: "Open semantic search",
  cmd_find_similar: "Find similar notes to current note",
  cmd_open_related_sidebar: "Open related notes sidebar",
  cmd_update_index: "Update search index",
  cmd_rebuild_index: "Rebuild search index from scratch",
  status_embeddings_count: "Embeddings: {count} notes",
  status_embeddings_empty: "Embeddings: empty",
  status_indexing_progress: "Indexing: {processed}/{total}",
  notice_indexing_running: "Indexing is already in progress.",
  notice_indexing_rebuilding: "Rebuilding semantic search index from scratch…",
  notice_indexing_updating: "Updating semantic search index…",
  notice_indexing_complete: "Indexing complete",
  notice_indexing_cancelled: "Indexing cancelled",
  notice_indexing_summary:
    "{prefix}: {indexed} updated, {skipped} unchanged, {removed} removed{failedPart}.",
  notice_indexing_failed_part: ", {failed} failed",
  notice_indexing_error: "Indexing error: {message}",
  notice_cancelling: "Cancelling indexing…",
  notice_index_cleared: "Search index cleared.",
  notice_note_not_found: "Note not found: {path}",
  error_incompatible_index:
    "Index was built with {indexModel}, but active model is {activeModel}. Please rebuild the index.",
  error_indexing_already_running: "Indexing is already in progress.",
  connection_success: "Connection successful! ({provider}: {model}, {dims} dimensions)",
  connection_failed: "Connection failed: {message}",
  search_placeholder: "Search notes semantically (e.g. topic, question, or concept)…",
  search_empty_status: "No notes indexed yet.",
  search_empty_desc:
    "Your semantic search index is still empty. Index your notes first to search them with AI embeddings.",
  search_empty_btn: "Index vault now",
  search_empty_btn_running: "Indexing…",
  search_ready_status: "{files} notes ({chunks} chunks) ready in index.",
  search_searching: "Searching…",
  search_generating: "Generating embedding & searching notes…",
  search_error: "Error: {message}",
  search_no_results: "No matching notes found.",
  search_no_results_hint:
    "Try a different phrasing or lower the minimum similarity in settings.",
  search_results_count: "{count} results found (↑/↓ navigate, Enter open)",
  related_title: "Related Notes",
  related_refresh_aria: "Refresh related notes",
  related_open_markdown: "Open a Markdown note to see related notes.",
  related_finding: "Finding notes related to \"{title}\"…",
  related_none: "No related notes found.",
  related_count: "{count} related notes",
  settings_title: "Semantic Embedding Search – Settings",
  settings_profile_name: "Active embedding profile",
  settings_profile_desc:
    "Select which configured embedding model/provider to use, or add a new one.",
  settings_profile_add: "+ Add",
  settings_profile_delete: "Delete",
  settings_profile_label: "Profile name",
  settings_profile_label_desc: "Display name for this embedding profile.",
  settings_profile_label_placeholder: "e.g. Ollama Local, LM Studio, OpenAI",
  settings_provider_type: "Provider type",
  settings_provider_type_desc: "Choose between local Ollama or an OpenAI-compatible API.",
  settings_provider_ollama: "Ollama (Local)",
  settings_provider_openai: "OpenAI / Compatible (LM Studio, vLLM, etc.)",
  settings_ollama_url: "Ollama URL",
  settings_ollama_url_desc: "Base URL of your running Ollama server.",
  settings_api_url: "API base URL",
  settings_api_url_desc:
    "E.g. https://api.openai.com/v1 or http://localhost:1234/v1 for LM Studio.",
  settings_api_key: "API key",
  settings_api_key_desc: "Optional for local servers (e.g. LM Studio).",
  settings_model: "Embedding model",
  settings_model_ollama_desc:
    "E.g. nomic-embed-text, mxbai-embed-large, bge-m3, or all-minilm.",
  settings_model_openai_desc:
    "E.g. text-embedding-3-small or text-embedding-3-large.",
  settings_test_connection: "Test connection",
  settings_test_connection_desc:
    "Checks whether the configured embedding model is reachable.",
  settings_test_btn: "Test",
  settings_test_btn_testing: "Testing…",

  settings_section_indexing: "Indexing & Search",
  settings_auto_index: "Auto-index",
  settings_auto_index_desc:
    "Automatically updates embeddings when notes are modified, created, or deleted.",
  settings_concurrency: "Parallel indexing requests",
  settings_concurrency_desc:
    "Number of notes to index concurrently when updating or rebuilding the index.",
  settings_batch_size: "Embedding batch size",
  settings_batch_size_desc:
    "Number of text chunks sent together in a single embedding API request.",
  settings_excluded_folders: "Excluded folders",
  settings_excluded_folders_desc:
    "Folder paths (comma-separated) to exclude from indexing.",
  settings_max_results: "Maximum search results",
  settings_max_results_desc: "Maximum number of notes to display.",
  settings_min_similarity: "Minimum similarity (%)",
  settings_min_similarity_desc:
    "Results below this similarity threshold are hidden.",
  settings_show_match_score: "Show match percentage",
  settings_show_match_score_desc:
    "Display the similarity percentage next to search and related note results.",
  settings_hybrid_search: "Hybrid search (Semantic + Keyword)",
  settings_hybrid_search_desc:
    "Combines vector similarity with keyword matching for better exact-term results.",
  settings_keyword_weight: "Keyword weight (%)",
  settings_keyword_weight_desc:
    "Balance between semantic similarity (0%) and keyword matching (100%).",
  settings_chunk_size: "Maximum chunk size (characters)",
  settings_chunk_size_desc: "Long notes are split into chunks of this size.",

  settings_section_status: "Index Status",
  settings_current_index: "Current index",
  settings_index_stats:
    "{files} notes, {chunks} chunks ({provider}: {model}, {dims} dimensions)",
  settings_index_empty: "Index is currently empty.",
  settings_btn_update: "Update",
  settings_btn_rebuild: "Rebuild",
  settings_btn_cancel: "Cancel",
  settings_btn_clear: "Clear",
} as const;

export type TranslationKey = keyof typeof en;
