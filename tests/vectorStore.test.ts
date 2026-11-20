import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { VectorStore, cosineSimilarity } from "../src/vectorStore.ts";

describe("cosineSimilarity", () => {
  it("computes exact cosine similarity", () => {
    assert.equal(cosineSimilarity([1, 0, 0], [1, 0, 0]), 1);
    assert.equal(cosineSimilarity([1, 0, 0], [0, 1, 0]), 0);
    assert.ok(Math.abs(cosineSimilarity([1, 1], [1, 0]) - Math.SQRT1_2) < 1e-9);
  });

  it("returns 0 for mismatched or zero vectors", () => {
    assert.equal(cosineSimilarity([1, 2], [1]), 0);
    assert.equal(cosineSimilarity([0, 0], [1, 2]), 0);
  });
});

describe("VectorStore", () => {
  it("ranks notes by best matching chunk and deduplicates per path", () => {
    const store = new VectorStore("ollama", "nomic-embed-text");

    store.upsertFile(
      { path: "a.md", mtime: 1, contentHash: "11111111", chunkIds: ["a.md#0", "a.md#1"] },
      [
        {
          id: "a.md#0",
          path: "a.md",
          title: "Note A",
          heading: "Intro",
          chunkIndex: 0,
          startLine: 0,
          content: "Note A > Intro\nUnrelated text",
          embedding: [0, 1, 0],
        },
        {
          id: "a.md#1",
          path: "a.md",
          title: "Note A",
          heading: "Details",
          chunkIndex: 1,
          startLine: 10,
          content: "Note A > Details\nExact match content",
          embedding: [0.95, 0.05, 0],
        },
      ]
    );

    store.upsertFile(
      { path: "b.md", mtime: 1, contentHash: "22222222", chunkIds: ["b.md#0"] },
      [
        {
          id: "b.md#0",
          path: "b.md",
          title: "Note B",
          heading: "",
          chunkIndex: 0,
          startLine: 0,
          content: "Note B\nPartial match",
          embedding: [0.6, 0.8, 0],
        },
      ]
    );

    const results = store.search([1, 0, 0], { maxResults: 10, minSimilarity: 0.5 });
    assert.equal(results.length, 2);
    assert.equal(results[0].path, "a.md");
    assert.equal(results[0].heading, "Details");
    assert.equal(results[1].path, "b.md");
  });

  it("supports rename, remove, and round-trip serialization", () => {
    const store = new VectorStore("openai", "text-embedding-3-small");
    store.upsertFile(
      { path: "old.md", mtime: 5, contentHash: "abcd1234", chunkIds: ["old.md#0"] },
      [
        {
          id: "old.md#0",
          path: "old.md",
          title: "old",
          heading: "",
          chunkIndex: 0,
          startLine: 0,
          content: "old\nHello",
          embedding: [1, 0],
        },
      ]
    );

    store.renameFile("old.md", "folder/new.md", "new");
    assert.equal(store.getFileMeta("old.md"), undefined);
    assert.ok(store.getFileMeta("folder/new.md"));

    const restored = VectorStore.deserialize(store.serialize(), "ollama", "nomic-embed-text");
    const stats = restored.getStats();
    assert.equal(stats.provider, "openai");
    assert.equal(stats.model, "text-embedding-3-small");
    assert.equal(stats.fileCount, 1);

    restored.removeFile("folder/new.md");
    assert.equal(restored.getStats().fileCount, 0);
  });
});
