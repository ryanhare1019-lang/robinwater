import type { Canvas, Idea, Connection, AITagDefinition } from '../types';

const SUPPORTED_VERSION = '1.0';
const MAX_FILE_CHARS = 10 * 1024 * 1024; // 10M characters
const LARGE_CANVAS_THRESHOLD = 5000;

export interface MonoliteFileCanvas {
  name: string;
  ideas: Idea[];
  connections: Connection[];
  aiTagDefinitions: AITagDefinition[];
}

export interface MonoliteFile {
  monolite_version: string;
  exported_at: string;
  canvas: MonoliteFileCanvas;
}

export type MonoliteParseResult =
  | { ok: true; canvas: MonoliteFileCanvas; exportedAt: string; skippedCount: number; versionWarning: boolean; largeCanvasWarning: boolean }
  | { ok: false; error: string };

// Strips HTML tags but keeps inner text content (used for export/serialize)
function stripHtmlTags(str: string): string {
  return str.replace(/<[^>]*>/g, '');
}

// Strips script/style tags AND their content, then remaining tags (used for import/parse)
function stripHtmlSafe(str: string): string {
  return str
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, '');
}

export function buildMonoliteFilename(canvasName: string): string {
  const safe = canvasName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `${safe}-monolite.monolite`;
}

export function serializeCanvas(canvas: Canvas): string {
  const sanitizeIdea = (idea: Idea): Idea => ({
    ...idea,
    text: stripHtmlSafe(idea.text),
    description: stripHtmlSafe(idea.description),
  });

  // Note: canvas.tags (custom color tags) are not exported — they are app-level
  // organizational data tied to tag IDs that won't be valid on another installation.
  // Only aiTagDefinitions (AI-generated semantic tags) are included in the share format.
  const file: MonoliteFile = {
    monolite_version: SUPPORTED_VERSION,
    exported_at: new Date().toISOString(),
    canvas: {
      name: canvas.name,
      ideas: canvas.ideas.map(sanitizeIdea),
      connections: canvas.connections,
      aiTagDefinitions: canvas.aiTagDefinitions ?? [],
    },
  };

  return JSON.stringify(file, null, 2);
}

function isValidIdea(idea: unknown): idea is Idea {
  if (!idea || typeof idea !== 'object') return false;
  const i = idea as Record<string, unknown>;
  return (
    typeof i.id === 'string' &&
    typeof i.text === 'string' &&
    typeof i.x === 'number' &&
    typeof i.y === 'number' &&
    typeof i.createdAt === 'string' &&
    (i.description == null || typeof i.description === 'string')
  );
}

export function parseMonoliteFile(raw: string): MonoliteParseResult {
  // Size check first
  if (raw.length > MAX_FILE_CHARS) {
    return { ok: false, error: 'INVALID FILE: TOO LARGE (MAX 10MB)' };
  }

  // JSON validity
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'INVALID FILE: NOT VALID JSON' };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'INVALID FILE: NOT A MONOLITE FILE' };
  }

  const file = parsed as Record<string, unknown>;

  // Version check
  if (typeof file.monolite_version !== 'string') {
    return { ok: false, error: 'INVALID FILE: NOT A MONOLITE FILE' };
  }

  // Canvas object check
  const canvasRaw = (typeof file.canvas === 'object' && file.canvas !== null)
    ? file.canvas as Record<string, unknown>
    : undefined;
  if (!canvasRaw || typeof canvasRaw.name !== 'string' || !('ideas' in canvasRaw)) {
    return { ok: false, error: 'INVALID FILE: MISSING CANVAS DATA' };
  }

  if (!Array.isArray(canvasRaw.ideas)) {
    return { ok: false, error: 'INVALID FILE: CORRUPTED IDEAS DATA' };
  }

  // Version warning
  const versionWarning = file.monolite_version !== SUPPORTED_VERSION;

  // Filter and sanitize ideas — skip bad ones, don't fail
  const allIdeas = canvasRaw.ideas as unknown[];
  const validIdeas: Idea[] = [];
  let skippedCount = 0;

  // ID remapping: old id → new id
  const idMap = new Map<string, string>();

  for (const rawIdea of allIdeas) {
    if (!isValidIdea(rawIdea)) {
      skippedCount++;
      continue;
    }
    const newId = crypto.randomUUID();
    idMap.set(rawIdea.id, newId);
    validIdeas.push({
      ...rawIdea,
      id: newId,
      text: stripHtmlSafe(rawIdea.text),
      description: stripHtmlSafe(rawIdea.description ?? ''),
    });
  }

  // Remap connections — skip any referencing missing IDs
  const rawConnections = Array.isArray(canvasRaw.connections) ? canvasRaw.connections as unknown[] : [];
  const connections: Connection[] = rawConnections
    .filter((c): c is { sourceId: string; targetId: string } =>
      !!c && typeof c === 'object' &&
      typeof (c as Record<string, unknown>).sourceId === 'string' &&
      typeof (c as Record<string, unknown>).targetId === 'string'
    )
    .filter((c) => idMap.has(c.sourceId) && idMap.has(c.targetId))
    .map((c) => ({
      id: crypto.randomUUID(),
      sourceId: idMap.get(c.sourceId)!,
      targetId: idMap.get(c.targetId)!,
    }));

  // Remap AI tag definitions
  const rawTags = Array.isArray(canvasRaw.aiTagDefinitions) ? canvasRaw.aiTagDefinitions as unknown[] : [];
  const aiTagDefinitions: AITagDefinition[] = rawTags
    .filter((t): t is { label: string; color: string; ideaIds: string[] } =>
      !!t && typeof t === 'object' &&
      typeof (t as Record<string, unknown>).label === 'string' &&
      typeof (t as Record<string, unknown>).color === 'string' &&
      Array.isArray((t as Record<string, unknown>).ideaIds)
    )
    .map((t) => ({
      id: crypto.randomUUID(),
      label: t.label,
      color: t.color,
      ideaIds: t.ideaIds.filter((id) => idMap.has(id)).map((id) => idMap.get(id)!),
    }));

  const largeCanvasWarning = validIdeas.length > LARGE_CANVAS_THRESHOLD;

  return {
    ok: true,
    canvas: {
      name: canvasRaw.name,
      ideas: validIdeas,
      connections,
      aiTagDefinitions,
    },
    exportedAt: typeof file.exported_at === 'string' ? file.exported_at : '',
    skippedCount,
    versionWarning,
    largeCanvasWarning,
  };
}
