/**
 * AYA OS v1.0 — Similarity Engine
 * Compares outfit DNA vectors. Rejects outfits with similarity > 70%.
 */

import { queryAll } from "../db.js";
import type { DNAVector } from "./dna.js";
import { DNA_DIMENSIONS, getOutfitDNA } from "./dna.js";

// ─── Cosine similarity between two DNA vectors ─────────────────────────────────

export function dnaSimilarity(a: DNAVector, b: DNAVector): number {
  let dot = 0, magA = 0, magB = 0;
  for (const dim of DNA_DIMENSIONS) {
    dot += a[dim] * b[dim];
    magA += a[dim] ** 2;
    magB += b[dim] ** 2;
  }
  if (!magA || !magB) return 0;
  const cosine = dot / (Math.sqrt(magA) * Math.sqrt(magB));
  // Convert from 0-1 range to 0-100 score
  return Math.round(cosine * 100);
}

// ─── Compare against recent outfits ────────────────────────────────────────────

export function checkSimilarityToRecent(
  candidateDNA: DNAVector,
  lookbackCount = 10
): { score: number; approved: boolean; mostSimilarId?: string } {
  const recentOutfits = queryAll<{ id: string }>(
    "SELECT id FROM Outfits ORDER BY created_at DESC LIMIT ?",
    [lookbackCount]
  );

  if (!recentOutfits.length) return { score: 0, approved: true };

  let maxScore = 0;
  let mostSimilarId: string | undefined;

  for (const outfit of recentOutfits) {
    const existingDNA = getOutfitDNA(outfit.id);
    const score = dnaSimilarity(candidateDNA, existingDNA);
    if (score > maxScore) {
      maxScore = score;
      mostSimilarId = outfit.id;
    }
  }

  return {
    score: maxScore,
    approved: maxScore <= 70,
    mostSimilarId,
  };
}

// ─── Compare against Google Flow Archive ──────────────────────────────────────

export function checkSimilarityToFlowArchive(
  candidateDNA: DNAVector
): { score: number; mostSimilarFlowId?: string } {
  const flowItems = queryAll<{ flow_id: string; dimension: string; score: number }>(
    "SELECT flow_id, dimension, score FROM FlowDNA"
  );

  // Group by flow_id
  const flowDNAs: Record<string, DNAVector> = {};
  for (const row of flowItems) {
    if (!flowDNAs[row.flow_id]) {
      flowDNAs[row.flow_id] = {} as DNAVector;
    }
    (flowDNAs[row.flow_id] as any)[row.dimension] = row.score;
  }

  let maxScore = 0;
  let mostSimilarFlowId: string | undefined;

  for (const [flowId, dna] of Object.entries(flowDNAs)) {
    const score = dnaSimilarity(candidateDNA, dna);
    if (score > maxScore) {
      maxScore = score;
      mostSimilarFlowId = flowId;
    }
  }

  return { score: maxScore, mostSimilarFlowId };
}

// ─── Color similarity between two garments ────────────────────────────────────

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

export function colorDistance(hex1: string, hex2: string): number {
  const [r1, g1, b1] = hexToRgb(hex1);
  const [r2, g2, b2] = hexToRgb(hex2);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}
