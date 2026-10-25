import { generateSingleEmbedding } from './gemini';

// In-memory query embedding cache: query string -> Float32Array
const queryEmbeddingCache = new Map<string, Float32Array>();

/**
 * Convert a JavaScript number array / Float32Array into a binary Buffer
 * for storage in Prisma Bytes fields.
 */
export function float32ArrayToBuffer(floats: number[] | Float32Array): Buffer {
  const f32 = floats instanceof Float32Array ? floats : new Float32Array(floats);
  return Buffer.from(f32.buffer, f32.byteOffset, f32.byteLength);
}

/**
 * Convert a stored Buffer from PostgreSQL Bytes back into a Float32Array.
 */
export function bufferToFloat32Array(buffer: Buffer | Uint8Array): Float32Array {
  const byteOffset = buffer.byteOffset;
  const length = buffer.byteLength / 4;
  return new Float32Array(buffer.buffer.slice(byteOffset, byteOffset + buffer.byteLength), 0, length);
}

/**
 * Compute the cosine similarity between two Float32 vectors in pure code.
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const valA = a[i];
    const valB = b[i];
    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dotProduct / denom;
}

/**
 * Get or compute an embedding for a query with in-memory caching.
 */
export async function getCachedQueryEmbedding(query: string): Promise<Float32Array> {
  const normalized = query.trim().toLowerCase();
  const cached = queryEmbeddingCache.get(normalized);
  if (cached) {
    return cached;
  }

  const values = await generateSingleEmbedding(query);
  const f32 = new Float32Array(values);
  // Cap cache size at 500 entries
  if (queryEmbeddingCache.size > 500) {
    const firstKey = queryEmbeddingCache.keys().next().value;
    if (firstKey) queryEmbeddingCache.delete(firstKey);
  }
  queryEmbeddingCache.set(normalized, f32);
  return f32;
}

export interface ChunkForRetrieval {
  id: string;
  documentId: string;
  documentTitle: string;
  pageNumber: number;
  chunkIndex: number;
  content: string;
  embedding: Buffer | null;
}

export interface RetrievedChunk {
  id: string;
  documentId: string;
  documentTitle: string;
  pageNumber: number;
  chunkIndex: number;
  content: string;
  score: number;
}

/**
 * Keyword relevance score (term frequency / keyword density across Indic and Latin tokens).
 */
export function calculateKeywordScore(query: string, content: string): number {
  const queryTokens = query
    .toLowerCase()
    .split(/[\s,.;:!?।॥۔"'/\\()\[\]{}]+/)
    .filter((t) => t.length > 1);

  if (queryTokens.length === 0) return 0;

  const contentLower = content.toLowerCase();
  let matches = 0;

  for (const token of queryTokens) {
    if (contentLower.includes(token)) {
      matches += 1;
    }
  }

  return matches / queryTokens.length;
}

/**
 * Hybrid retrieval (vector + keyword), top 20, re-rank, neighbour expansion, capped context (top 6-8).
 */
export function hybridRetrieveChunks(
  query: string,
  queryVec: Float32Array,
  allChunks: ChunkForRetrieval[],
  similarityThreshold: number = 0.42,
  topK: number = 8
): { topChunks: RetrievedChunk[]; maxScore: number } {
  if (allChunks.length === 0) {
    return { topChunks: [], maxScore: 0 };
  }

  const scored: Array<{
    chunk: ChunkForRetrieval;
    vectorScore: number;
    keywordScore: number;
    combinedScore: number;
  }> = [];

  for (const chunk of allChunks) {
    let vecScore = 0;
    if (chunk.embedding) {
      try {
        const chunkVec = bufferToFloat32Array(chunk.embedding);
        vecScore = cosineSimilarity(queryVec, chunkVec);
      } catch {
        vecScore = 0;
      }
    }

    const kwScore = calculateKeywordScore(query, chunk.content);
    // Weighted combination: 75% vector similarity + 25% keyword relevance
    const combinedScore = vecScore * 0.75 + kwScore * 0.25;

    scored.push({
      chunk,
      vectorScore: vecScore,
      keywordScore: kwScore,
      combinedScore,
    });
  }

  // Sort descending by combined score
  scored.sort((a, b) => b.combinedScore - a.combinedScore);

  const top20 = scored.slice(0, 20);
  const maxScore = top20.length > 0 ? top20[0].combinedScore : 0;

  // Filter chunks meeting minimum threshold
  const qualifying = top20.filter((item) => item.combinedScore >= similarityThreshold);

  if (qualifying.length === 0) {
    return { topChunks: [], maxScore };
  }

  // Neighbour expansion: for each top chunk, identify if adjacent chunk (chunkIndex +- 1) adds valuable context
  const selectedChunkIds = new Set<string>();
  const finalChunks: RetrievedChunk[] = [];

  // Group all chunks by document and chunkIndex for quick lookup
  const chunkMap = new Map<string, ChunkForRetrieval>();
  for (const c of allChunks) {
    chunkMap.set(`${c.documentId}:${c.chunkIndex}`, c);
  }

  for (const item of qualifying) {
    if (finalChunks.length >= topK) break;

    if (!selectedChunkIds.has(item.chunk.id)) {
      selectedChunkIds.add(item.chunk.id);
      finalChunks.push({
        id: item.chunk.id,
        documentId: item.chunk.documentId,
        documentTitle: item.chunk.documentTitle,
        pageNumber: item.chunk.pageNumber,
        chunkIndex: item.chunk.chunkIndex,
        content: item.chunk.content,
        score: Math.round(item.combinedScore * 100) / 100,
      });

      // Neighbour expansion: look for adjacent neighbour (chunkIndex + 1)
      if (finalChunks.length < topK) {
        const nextNeighbour = chunkMap.get(`${item.chunk.documentId}:${item.chunk.chunkIndex + 1}`);
        if (nextNeighbour && !selectedChunkIds.has(nextNeighbour.id)) {
          selectedChunkIds.add(nextNeighbour.id);
          finalChunks.push({
            id: nextNeighbour.id,
            documentId: nextNeighbour.documentId,
            documentTitle: nextNeighbour.documentTitle,
            pageNumber: nextNeighbour.pageNumber,
            chunkIndex: nextNeighbour.chunkIndex,
            content: nextNeighbour.content,
            score: Math.round(item.combinedScore * 0.9 * 100) / 100,
          });
        }
      }
    }
  }

  // Sort by documentTitle, pageNumber, and chunkIndex for natural narrative reading order
  finalChunks.sort((a, b) => {
    if (a.documentId !== b.documentId) return a.documentId.localeCompare(b.documentId);
    if (a.pageNumber !== b.pageNumber) return a.pageNumber - b.pageNumber;
    return a.chunkIndex - b.chunkIndex;
  });

  return {
    topChunks: finalChunks.slice(0, topK),
    maxScore,
  };
}
