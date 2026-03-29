const STOP_WORDS = new Set([
  "a", "an", "the", "is", "it", "to", "and", "of", "in", "for", "on",
  "with", "that", "this", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "can", "shall", "not", "no", "but", "or",
  "if", "then", "than", "so", "as", "at", "by", "from", "up", "out",
  "about", "into", "through", "during", "before", "after", "above",
  "below", "between", "under", "again", "further", "once", "here",
  "there", "when", "where", "why", "how", "all", "each", "every",
  "both", "few", "more", "most", "other", "some", "such", "only",
  "own", "same", "too", "very", "just", "because", "its", "also",
  "what", "which", "who", "whom", "these", "those", "am", "your",
  "you", "we", "they", "he", "she", "her", "his", "my", "our",
  "their", "me", "him", "us", "them", "i", "get", "got", "like",
  "make", "need", "want", "use", "new", "one", "two",
]);

export function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
}
