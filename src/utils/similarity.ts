import { Idea } from "../types";

export function getSharedKeywordCount(a: Idea, b: Idea): number {
  let count = 0;
  for (const keyword of a.keywords) {
    if (b.keywords.includes(keyword)) {
      count++;
    }
  }
  return count;
}

export interface SimilarityLine {
  fromId: string;
  toId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

export function computeSimilarityLines(ideas: Idea[]): SimilarityLine[] {
  const lines: SimilarityLine[] = [];
  for (let i = 0; i < ideas.length; i++) {
    for (let j = i + 1; j < ideas.length; j++) {
      if (getSharedKeywordCount(ideas[i], ideas[j]) >= 2) {
        lines.push({
          fromId: ideas[i].id,
          toId: ideas[j].id,
          fromX: ideas[i].x,
          fromY: ideas[i].y,
          toX: ideas[j].x,
          toY: ideas[j].y,
        });
      }
    }
  }
  return lines;
}
