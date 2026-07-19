/**
 * AYA OS v1.0 — DNA Engine
 * Computes, stores, and retrieves Outfit DNA.
 * DNA = weighted aggregate of garment-level DNA dimensions.
 */

import { queryAll, queryOne, run, saveDb } from "../db.js";

export const DNA_DIMENSIONS = [
  "Authority",
  "Luxury",
  "Minimalism",
  "Warmth",
  "Confidence",
  "Creativity",
  "Professionalism",
  "VisualWeight",
  "Contrast",
  "Texture",
  "Formality",
  "Traditional",
  "Modern",
  "Experimental",
  "Approachability",
  "Photogenic",
  "Complexity",
] as const;

export type DNADimension = typeof DNA_DIMENSIONS[number];
export type DNAVector = Record<DNADimension, number>;

export function emptyDNA(): DNAVector {
  return Object.fromEntries(DNA_DIMENSIONS.map((d) => [d, 50])) as DNAVector;
}

// ─── Garment DNA ──────────────────────────────────────────────────────────────

export function getGarmentDNA(garmentId: string): DNAVector {
  const rows = queryAll<{ dimension: string; score: number }>(
    "SELECT dimension, score FROM GarmentDNA WHERE garment_id = ?",
    [garmentId]
  );
  const dna = emptyDNA();
  for (const row of rows) {
    if (row.dimension in dna) dna[row.dimension as DNADimension] = row.score;
  }
  return dna;
}

export function setGarmentDNA(garmentId: string, dna: Partial<DNAVector>): void {
  for (const [dimension, score] of Object.entries(dna)) {
    run(
      `INSERT INTO GarmentDNA (garment_id, dimension, score)
       VALUES (?, ?, ?)
       ON CONFLICT(garment_id, dimension) DO UPDATE SET score = excluded.score`,
      [garmentId, dimension, score]
    );
  }
  saveDb();
}

// ─── Outfit DNA ───────────────────────────────────────────────────────────────

/**
 * Compute outfit DNA from garment IDs.
 * Weighted by garment role: top/outerwear get higher weight.
 */
export function computeOutfitDNA(garmentIds: string[]): DNAVector {
  if (!garmentIds.length) return emptyDNA();

  const dnaVectors = garmentIds.map((id) => getGarmentDNA(id));
  const result = emptyDNA();

  for (const dim of DNA_DIMENSIONS) {
    const scores = dnaVectors.map((v) => v[dim]).filter((s) => s !== undefined);
    result[dim] = scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 50;
  }

  return result;
}

export function storeOutfitDNA(outfitId: string, dna: DNAVector): void {
  // Delete existing and reinsert
  run("DELETE FROM OutfitDNA WHERE outfit_id = ?", [outfitId]);
  for (const [dimension, score] of Object.entries(dna)) {
    run(
      `INSERT INTO OutfitDNA (outfit_id, dimension, score) VALUES (?, ?, ?)`,
      [outfitId, dimension, score]
    );
  }
  saveDb();
}

export function getOutfitDNA(outfitId: string): DNAVector {
  const rows = queryAll<{ dimension: string; score: number }>(
    "SELECT dimension, score FROM OutfitDNA WHERE outfit_id = ?",
    [outfitId]
  );
  const dna = emptyDNA();
  for (const row of rows) {
    if (row.dimension in dna) dna[row.dimension as DNADimension] = row.score;
  }
  return dna;
}

// ─── DNA summary string for AI prompts ────────────────────────────────────────

export function dnaToString(dna: DNAVector): string {
  return DNA_DIMENSIONS.map((d) => `${d}: ${dna[d]}`).join(" | ");
}

// ─── Top DNA dimensions ───────────────────────────────────────────────────────

export function topDimensions(dna: DNAVector, n = 3): string[] {
  return DNA_DIMENSIONS.sort((a, b) => dna[b] - dna[a]).slice(0, n);
}
