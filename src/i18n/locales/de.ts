import type { TranslationKey } from "./en";

export const de: Record<TranslationKey, string> = {
  cmd_open_search: "Semantische Suche öffnen",
  cmd_find_similar: "Ähnliche Notizen zur aktuellen Notiz finden",
  cmd_open_related_sidebar: "Seitenleiste für ähnliche Notizen öffnen",
  cmd_update_index: "Suchindex aktualisieren",
  cmd_rebuild_index: "Suchindex komplett neu aufbauen",
  status_embeddings_count: "Embeddings: {count} Notizen",
  status_embeddings_empty: "Embeddings: leer",
  status_indexing_progress: "Indexiere: {processed}/{total}",
  notice_indexing_running: "Indexierung läuft bereits.",
  notice_indexing_rebuilding: "Baue semantischen Suchindex komplett neu auf…",
  notice_indexing_updating: "Aktualisiere semantischen Suchindex…",
  notice_indexing_complete: "Indexierung fertig",
  notice_indexing_cancelled: "Indexierung abgebrochen",
  notice_indexing_summary:
    "{prefix}: {indexed} aktualisiert, {skipped} unverändert, {removed} entfernt{failedPart}.",
  notice_indexing_failed_part: ", {failed} fehlgeschlagen",
  notice_indexing_error: "Fehler bei Indexierung: {message}",
  notice_cancelling: "Breche Indexierung ab…",
  notice_index_cleared: "Suchindex geleert.",
  notice_note_not_found: "Notiz nicht gefunden: {path}",
  error_incompatible_index:
    "Index wurde mit {indexModel} erstellt, aktiv ist {activeModel}. Bitte Index neu aufbauen.",
  error_indexing_already_running: "Indexierung läuft bereits.",
  connection_success: "Verbindung erfolgreich! ({provider}: {model}, {dims} Dimensionen)",
  connection_failed: "Verbindung fehlgeschlagen: {message}",
  search_placeholder: "Notizen semantisch durchsuchen (z. B. Thema, Frage oder Konzept)…",
  search_empty_status: "Noch keine Notizen indexiert.",
  search_empty_desc:
    "Dein semantischer Suchindex ist noch leer. Indexiere zuerst deine Notizen, um sie mit KI-Embeddings zu durchsuchen.",
  search_empty_btn: "Vault jetzt indexieren",
  search_empty_btn_running: "Indexierung läuft…",
  search_ready_status: "{files} Notizen ({chunks} Abschnitte) im Index bereit.",
  search_searching: "Suche läuft…",
  search_generating: "Erzeuge Embedding & durchsuche Notizen…",
  search_error: "Fehler: {message}",
  search_no_results: "Keine passenden Notizen gefunden.",
  search_no_results_hint:
    "Versuche eine andere Formulierung oder senke die Mindest-Ähnlichkeit in den Einstellungen.",
  search_results_count: "{count} Treffer gefunden (↑/↓ navigieren, Enter öffnen)",
  related_title: "Ähnliche Notizen",
  related_refresh_aria: "Ähnliche Notizen aktualisieren",
  related_open_markdown: "Öffne eine Markdown-Notiz, um ähnliche Notizen zu sehen.",
  related_finding: "Suche ähnliche Notizen zu „{title}“…",
  related_none: "Keine ähnlichen Notizen gefunden.",
  related_count: "{count} ähnliche Notizen",
  settings_title: "Semantic Embedding Search – Einstellungen",
  settings_profile_name: "Aktives Embedding-Profil",
  settings_profile_desc:
    "Wähle das zu verwendende Embedding-Modell/den Anbieter aus oder füge ein neues Profil hinzu.",
  settings_profile_add: "+ Hinzufügen",
  settings_profile_delete: "Löschen",
  settings_profile_label: "Profilname",
  settings_profile_label_desc: "Anzeigename für dieses Embedding-Profil.",
  settings_profile_label_placeholder: "z. B. Ollama Lokal, LM Studio, OpenAI",
  settings_provider_type: "Anbieter-Typ",
  settings_provider_type_desc:
    "Wähle zwischen lokalem Ollama oder einer OpenAI-kompatiblen API.",
  settings_provider_ollama: "Ollama (Lokal)",
  settings_provider_openai: "OpenAI / Kompatibel (LM Studio, vLLM, etc.)",
  settings_ollama_url: "Ollama URL",
  settings_ollama_url_desc: "Basis-URL deines laufenden Ollama-Servers.",
  settings_api_url: "API Basis-URL",
  settings_api_url_desc:
    "Z. B. https://api.openai.com/v1 oder http://localhost:1234/v1 für LM Studio.",
  settings_api_key: "API-Schlüssel",
  settings_api_key_desc: "Optional bei lokalen Servern (z. B. LM Studio).",
  settings_model: "Embedding-Modell",
  settings_model_ollama_desc:
    "Z. B. nomic-embed-text, mxbai-embed-large, bge-m3 oder all-minilm.",
  settings_model_openai_desc:
    "Z. B. text-embedding-3-small oder text-embedding-3-large.",
  settings_test_connection: "Verbindung testen",
  settings_test_connection_desc:
    "Prüft, ob das konfigurierte Embedding-Modell erreichbar ist.",
  settings_test_btn: "Testen",
  settings_test_btn_testing: "Teste…",

  settings_section_indexing: "Indexierung & Suche",
  settings_auto_index: "Automatisch indexieren",
  settings_auto_index_desc:
    "Aktualisiert Embeddings automatisch, wenn Notizen geändert, erstellt oder gelöscht werden.",
  settings_concurrency: "Parallele Indexierungs-Anfragen",
  settings_concurrency_desc:
    "Anzahl der Notizen, die beim Aktualisieren oder Neuaufbau gleichzeitig indexiert werden.",
  settings_batch_size: "Embedding-Batch-Größe",
  settings_batch_size_desc:
    "Anzahl der Textabschnitte, die zusammen in einem einzigen Embedding-API-Request gesendet werden.",
  settings_excluded_folders: "Ausgeschlossene Ordner",
  settings_excluded_folders_desc:
    "Ordnerpfade (kommagetrennt), die nicht indexiert werden sollen.",
  settings_max_results: "Maximale Suchergebnisse",
  settings_max_results_desc: "Wie viele Notizen maximal angezeigt werden.",
  settings_min_similarity: "Mindest-Ähnlichkeit (%)",
  settings_min_similarity_desc:
    "Ergebnisse unter diesem Ähnlichkeitswert werden ausgeblendet.",
  settings_show_match_score: "Übereinstimmung in % anzeigen",
  settings_show_match_score_desc:
    "Zeigt die prozentuale Ähnlichkeit neben Suchergebnissen und ähnlichen Notizen an.",
  settings_hybrid_search: "Hybrid-Suche (Semantisch + Keyword)",
  settings_hybrid_search_desc:
    "Kombiniert Vektor-Ähnlichkeit mit Keyword-Abgleich für bessere Treffer bei exakten Begriffen.",
  settings_keyword_weight: "Keyword-Gewichtung (%)",
  settings_keyword_weight_desc:
    "Verhältnis zwischen semantischer Ähnlichkeit (0%) und Keyword-Abgleich (100%).",
  settings_chunk_size: "Maximale Chunk-Größe (Zeichen)",
  settings_chunk_size_desc:
    "Lange Notizen werden in Abschnitte dieser Größe unterteilt.",

  settings_section_status: "Index-Status",
  settings_current_index: "Aktueller Index",
  settings_index_stats:
    "{files} Notizen, {chunks} Abschnitte ({provider}: {model}, {dims} Dimensionen)",
  settings_index_empty: "Index ist derzeit leer.",
  settings_btn_update: "Aktualisieren",
  settings_btn_rebuild: "Neu aufbauen",
  settings_btn_cancel: "Abbrechen",
  settings_btn_clear: "Leeren",
};
