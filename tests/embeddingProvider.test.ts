import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  OllamaEmbeddingProvider,
  OpenAIEmbeddingProvider,
} from "../src/providers/embeddingProvider.ts";
import type { HttpClient } from "../src/types.ts";

describe("OllamaEmbeddingProvider", () => {
  it("calls /api/embed and returns embeddings", async () => {
    let capturedUrl = "";
    const mockHttp: HttpClient = async (req) => {
      capturedUrl = req.url;
      return {
        status: 200,
        json: { embeddings: [[0.1, 0.2], [0.3, 0.4]] },
        text: "",
      };
    };

    const provider = new OllamaEmbeddingProvider("http://localhost:11434/", "nomic-embed-text", mockHttp);
    const result = await provider.embed(["a", "b"]);

    assert.equal(capturedUrl, "http://localhost:11434/api/embed");
    assert.deepEqual(result, [[0.1, 0.2], [0.3, 0.4]]);
  });
});

describe("OpenAIEmbeddingProvider", () => {
  it("calls /embeddings and sorts results by index", async () => {
    let capturedAuth = "";
    const mockHttp: HttpClient = async (req) => {
      capturedAuth = req.headers?.Authorization ?? "";
      return {
        status: 200,
        json: {
          data: [
            { index: 1, embedding: [0.9, 0.8] },
            { index: 0, embedding: [0.1, 0.2] },
          ],
        },
        text: "",
      };
    };

    const provider = new OpenAIEmbeddingProvider(
      "https://api.openai.com/v1",
      "sk-test",
      "text-embedding-3-small",
      mockHttp
    );
    const result = await provider.embed(["first", "second"]);

    assert.equal(capturedAuth, "Bearer sk-test");
    assert.deepEqual(result, [[0.1, 0.2], [0.9, 0.8]]);
  });
});
