/**
 * AYA OS v1.0 — Purchase / ROI Engine
 * Calculates return-on-investment for shopping candidates.
 */

import { queryAll, queryOne, run, saveDb, log } from "../db.js";

export interface ShoppingCandidate {
  id: number;
  item_name: string;
  brand?: string;
  category?: string;
  estimated_price?: number;
  actual_price?: number;
  unlock_count: number;
  roi_score?: number;
  cost_per_wear?: number;
  season_coverage?: string;
  occasion_coverage?: string;
  duplication_check?: string;
  maintenance_cost?: string;
  photography_value?: number;
  status: string;
  notes?: string;
  added_at: string;
}

// ─── Get candidates ───────────────────────────────────────────────────────────

export function getShoppingCandidates(): ShoppingCandidate[] {
  return queryAll<ShoppingCandidate>(
    "SELECT * FROM Shopping WHERE status = 'candidate' ORDER BY roi_score DESC NULLS LAST"
  );
}

export function getAllShopping(): ShoppingCandidate[] {
  return queryAll<ShoppingCandidate>(
    "SELECT * FROM Shopping ORDER BY added_at DESC"
  );
}

// ─── Calculate ROI ────────────────────────────────────────────────────────────

export interface ROIInput {
  item_name: string;
  category: string;
  price: number;
  seasons: string[];       // e.g. ["summer", "monsoon"]
  occasions: string[];     // e.g. ["casual", "smart_casual"]
  maintenance: "low" | "medium" | "high";
  brand_tier?: string;     // luxury | premium | mid | affordable
  photography_value?: number; // 0-100
}

export function calculateROI(input: ROIInput): {
  unlock_count: number;
  estimated_wears_per_year: number;
  cost_per_wear: number;
  roi_score: number;
  verdict: "approve" | "consider" | "reject";
  reasoning: string[];
} {
  const {
    price,
    seasons,
    occasions,
    maintenance,
    brand_tier = "mid",
    photography_value = 50,
  } = input;

  // Count garments that pair well (simplified: count by seasons/occasions match)
  const garments = queryAll<{ id: string; category: string }>(
    "SELECT id, category FROM Garments WHERE archived = 0 AND deleted = 0"
  );

  // Estimate unlock count: garments that could work with this new item
  const unlock_count = Math.min(garments.length * 0.4, garments.length);

  // Estimated wears per year based on seasons and occasions
  const seasonMultiplier = seasons.length / 4;           // 1 = all seasons
  const occasionMultiplier = occasions.length / 5;       // 1 = all occasions
  const estimated_wears_per_year = Math.round(
    50 * seasonMultiplier * occasionMultiplier
  );

  const cost_per_wear =
    estimated_wears_per_year > 0
      ? parseFloat((price / estimated_wears_per_year).toFixed(2))
      : price;

  // Check for duplication
  const similar = queryAll<{ item_name: string }>(
    "SELECT item_name FROM Garments WHERE category = ? AND deleted = 0",
    [input.category]
  );

  const maintenancePenalty = maintenance === "high" ? 20 : maintenance === "medium" ? 10 : 0;
  const luxuryBonus = brand_tier === "luxury" ? 10 : brand_tier === "premium" ? 5 : 0;

  // ROI score formula (0–100)
  const roi_score = Math.round(
    Math.min(100,
      (unlock_count * 2) +
      (seasonMultiplier * 20) +
      (occasionMultiplier * 20) +
      (photography_value * 0.2) +
      luxuryBonus -
      maintenancePenalty -
      (similar.length > 3 ? 15 : 0) +    // duplication penalty
      (cost_per_wear < 50 ? 10 : 0)       // cost-efficiency bonus
    )
  );

  const reasoning: string[] = [];
  if (unlock_count > 10) reasoning.push(`Enables ~${Math.round(unlock_count)} new combinations`);
  if (seasons.length >= 3) reasoning.push("Multi-season versatility");
  if (occasions.length >= 3) reasoning.push("Cross-occasion flexibility");
  if (similar.length > 3) reasoning.push(`⚠ You already own ${similar.length} similar ${input.category}`);
  if (cost_per_wear < 20) reasoning.push(`Excellent cost-per-wear: ₹${cost_per_wear}`);
  if (maintenance === "high") reasoning.push("⚠ High maintenance cost");

  const verdict: "approve" | "consider" | "reject" =
    roi_score >= 65 ? "approve" :
    roi_score >= 40 ? "consider" : "reject";

  return {
    unlock_count: Math.round(unlock_count),
    estimated_wears_per_year,
    cost_per_wear,
    roi_score,
    verdict,
    reasoning,
  };
}

// ─── Add / update candidates ──────────────────────────────────────────────────

export function addShoppingCandidate(
  item: Partial<ShoppingCandidate>
): void {
  run(
    `INSERT INTO Shopping
     (item_name, brand, category, estimated_price, season_coverage, occasion_coverage,
      maintenance_cost, photography_value, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'candidate', ?)`,
    [
      item.item_name ?? "Unknown",
      item.brand ?? null,
      item.category ?? null,
      item.estimated_price ?? null,
      item.season_coverage ?? null,
      item.occasion_coverage ?? null,
      item.maintenance_cost ?? null,
      item.photography_value ?? null,
      item.notes ?? null,
    ]
  );
  saveDb();
  log("info", "shopping", `New shopping candidate: ${item.item_name}`);
}

export function updateShoppingStatus(
  id: number,
  status: "purchased" | "rejected" | "wishlist" | "candidate",
  actual_price?: number
): void {
  run(
    "UPDATE Shopping SET status = ?, actual_price = ?, purchase_date = datetime('now') WHERE id = ?",
    [status, actual_price ?? null, id]
  );
  saveDb();
  log(
    status === "purchased" ? "success" : "info",
    "shopping",
    `Shopping item #${id} → ${status}`
  );
}
