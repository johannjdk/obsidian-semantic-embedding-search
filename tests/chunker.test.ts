import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chunkMarkdown, hashContent } from "../src/chunker.ts";

describe("hashContent", () => {
  it("produces deterministic 8-char hex hashes", () => {
    const h1 = hashContent("Hallo Obsidian");
    const h2 = hashContent("Hallo Obsidian");
    const h3 = hashContent("Hallo Welt");

    assert.equal(h1, h2);
    assert.notEqual(h1, h3);
    assert.match(h1, /^[0-9a-f]{8}$/);
  });
});

describe("chunkMarkdown", () => {
  it("strips YAML frontmatter and tracks line offsets", () => {
    const md = [
      "---",
      "title: Test",
      "tags: [a, b]",
      "---",
      "# Einführung",
      "Das ist der erste Absatz.",
    ].join("\n");

    const chunks = chunkMarkdown("notes/test.md", "test", md, {
      maxChunkChars: 1000,
      chunkOverlapChars: 100,
    });

    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].heading, "Einführung");
    assert.equal(chunks[0].startLine, 4);
    assert.ok(!chunks[0].content.includes("tags: [a, b]"));
    assert.ok(chunks[0].content.includes("test > Einführung"));
  });

  it("splits long sections into overlapping chunks", () => {
    const paragraph = "Dies ist ein längerer Satz über KI-Embeddings und semantische Suche. ";
    const longBody = `# Großer Abschnitt\n${paragraph.repeat(15)}`;

    const chunks = chunkMarkdown("long.md", "long", longBody, {
      maxChunkChars: 300,
      chunkOverlapChars: 50,
    });

    assert.ok(chunks.length > 2);
    for (const chunk of chunks) {
      assert.ok(chunk.content.length <= 320);
      assert.equal(chunk.heading, "Großer Abschnitt");
    }
  });

  it("returns empty array for empty or frontmatter-only notes", () => {
    const md = "---\ntitle: Leer\n---\n\n   \n";
    const chunks = chunkMarkdown("empty.md", "empty", md, {
      maxChunkChars: 1000,
      chunkOverlapChars: 100,
    });
    assert.equal(chunks.length, 0);
  });
});
