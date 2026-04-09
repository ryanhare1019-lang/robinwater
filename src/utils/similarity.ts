import { Idea } from "../types";

export interface SimilarityLine {
  fromId: string;
  toId: string;
}

export function computeSimilarityLines(ideas: Idea[]): SimilarityLine[] {
  const lines: SimilarityLine[] = [];
  for (let i = 0; i < ideas.length; i++) {
    const aKeywords = ideas[i].keywords;
    for (let j = i + 1; j < ideas.length; j++) {
      const bSet = new Set(ideas[j].keywords);
      let count = 0;
      for (const kw of aKeywords) {
        if (bSet.has(kw)) count++;
      }
      if (count >= 2) {
        lines.push({ fromId: ideas[i].id, toId: ideas[j].id });
      }
    }
  }
  return lines;
}
