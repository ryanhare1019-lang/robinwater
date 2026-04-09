import { Idea, Connection } from "../types";

export interface SimilarityLine {
  fromId: string;
  toId: string;
  reason?: 'keyword' | 'tag';
}

export function computeSimilarityLines(ideas: Idea[], connections: Connection[] = []): SimilarityLine[] {
  const lines: SimilarityLine[] = [];

  // Build a set of already-connected pairs for dedup
  const connectedPairs = new Set(
    connections.flatMap(c => [`${c.sourceId}-${c.targetId}`, `${c.targetId}-${c.sourceId}`])
  );

  // Track pairs already added to avoid duplicates
  const existingPairs = new Set<string>();

  // Keyword-based similarity (2+ shared keywords)
  for (let i = 0; i < ideas.length; i++) {
    const aKeywords = ideas[i].keywords;
    for (let j = i + 1; j < ideas.length; j++) {
      const pairKey = `${ideas[i].id}-${ideas[j].id}`;
      if (connectedPairs.has(pairKey) || connectedPairs.has(`${ideas[j].id}-${ideas[i].id}`)) continue;
      const bSet = new Set(ideas[j].keywords);
      let count = 0;
      for (const kw of aKeywords) {
        if (bSet.has(kw)) count++;
      }
      if (count >= 2) {
        lines.push({ fromId: ideas[i].id, toId: ideas[j].id, reason: 'keyword' });
        existingPairs.add(pairKey);
      }
    }
  }

  // Tag-based similarity (any shared tag or aiTag)
  for (let i = 0; i < ideas.length; i++) {
    const aTags = [...(ideas[i].tags || []), ...(ideas[i].aiTags || [])];
    if (aTags.length === 0) continue;

    for (let j = i + 1; j < ideas.length; j++) {
      const pairKey = `${ideas[i].id}-${ideas[j].id}`;
      if (existingPairs.has(pairKey)) continue;
      if (connectedPairs.has(pairKey) || connectedPairs.has(`${ideas[j].id}-${ideas[i].id}`)) continue;

      const bTags = new Set([...(ideas[j].tags || []), ...(ideas[j].aiTags || [])]);
      const sharedTag = aTags.some(t => bTags.has(t));

      if (sharedTag) {
        lines.push({ fromId: ideas[i].id, toId: ideas[j].id, reason: 'tag' });
        existingPairs.add(pairKey);
      }
    }
  }

  return lines;
}
