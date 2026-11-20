import type { NoteChunk } from "./types";

export interface ChunkOptions {
  maxChunkChars: number;
  chunkOverlapChars: number;
}
export function hashContent(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

interface Section {
  heading: string;
  startLine: number;
  lines: string[];
}
function stripFrontmatter(lines: string[]): { bodyLines: string[]; lineOffset: number } {
  if (lines.length === 0 || lines[0].trim() !== "---") {
    return { bodyLines: lines, lineOffset: 0 };
  }

  for (let i = 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === "---" || trimmed === "...") {
      return {
        bodyLines: lines.slice(i + 1),
        lineOffset: i + 1,
      };
    }
  }

  return { bodyLines: lines, lineOffset: 0 };
}
export function chunkMarkdown(
  path: string,
  title: string,
  markdown: string,
  options: ChunkOptions
): NoteChunk[] {
  const maxChars = Math.max(200, options.maxChunkChars);
  const overlap = Math.max(0, Math.min(options.chunkOverlapChars, Math.floor(maxChars / 2)));

  const allLines = markdown.replace(/\r\n/g, "\n").split("\n");
  const { bodyLines, lineOffset } = stripFrontmatter(allLines);

  const sections: Section[] = [];
  let current: Section = { heading: "", startLine: lineOffset, lines: [] };

  for (let i = 0; i < bodyLines.length; i++) {
    const line = bodyLines[i];
    const headingMatch = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (headingMatch) {
      if (current.lines.some((l) => l.trim().length > 0)) {
        sections.push(current);
      }
      current = {
        heading: headingMatch[2],
        startLine: lineOffset + i,
        lines: [line],
      };
    } else {
      current.lines.push(line);
    }
  }

  if (current.lines.some((l) => l.trim().length > 0)) {
    sections.push(current);
  }

  const chunks: NoteChunk[] = [];
  let chunkIndex = 0;

  for (const section of sections) {
    const rawText = section.lines.join("\n").trim();
    if (!rawText) continue;

    const prefix = section.heading ? `${title} > ${section.heading}\n` : `${title}\n`;
    const subChunks = splitTextWithOverlap(rawText, maxChars - prefix.length, overlap);

    for (const part of subChunks) {
      const trimmedPart = part.trim();
      if (!trimmedPart) continue;

      chunks.push({
        id: `${path}#${chunkIndex}`,
        path,
        title,
        heading: section.heading,
        chunkIndex,
        startLine: section.startLine,
        content: `${prefix}${trimmedPart}`,
      });
      chunkIndex++;
    }
  }

  return chunks;
}
function splitTextWithOverlap(text: string, maxLen: number, overlap: number): string[] {
  const safeMax = Math.max(100, maxLen);
  if (text.length <= safeMax) {
    return [text];
  }

  const parts: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + safeMax, text.length);

    if (end < text.length) {
      const window = text.slice(start, end);
      const paragraphBreak = window.lastIndexOf("\n\n");
      const lineBreak = window.lastIndexOf("\n");
      const spaceBreak = window.lastIndexOf(" ");

      if (paragraphBreak > safeMax * 0.4) {
        end = start + paragraphBreak;
      } else if (lineBreak > safeMax * 0.4) {
        end = start + lineBreak;
      } else if (spaceBreak > safeMax * 0.4) {
        end = start + spaceBreak;
      }
    }

    const slice = text.slice(start, end).trim();
    if (slice.length > 0) {
      parts.push(slice);
    }

    if (end >= text.length) {
      break;
    }

    const nextStart = end - overlap;
    start = nextStart > start ? nextStart : end;
  }

  return parts;
}
