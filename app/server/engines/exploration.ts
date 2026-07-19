/**
 * AYA OS v1.0 — Exploration Engine
 * Manages Unknown Territory. Proposes low-risk style experiments.
 * Enforces the 90/10 rule: 90% identity, 10% exploration.
 */

import { queryAll, queryOne, run, saveDb, log } from "../db.js";

export interface ExplorationItem {
  id: number;
  description: string;
  type: string;
  status: string;
  risk_level: string;
  added_at: string;
}

// ─── Get untested experiments ─────────────────────────────────────────────────

export function getUntestedItems(limit = 5): ExplorationItem[] {
  return queryAll<ExplorationItem>(
    `SELECT * FROM UnknownTerritory
     WHERE status = 'untested'
     ORDER BY risk_level ASC, added_at ASC
     LIMIT ?`,
    [limit]
  );
}

export function getAllUnknownTerritory(): ExplorationItem[] {
  return queryAll<ExplorationItem>(
    "SELECT * FROM UnknownTerritory ORDER BY status ASC, risk_level ASC"
  );
}

// ─── Pick one exploration experiment for an outfit ────────────────────────────

export function pickExploration(): ExplorationItem | null {
  return queryOne<ExplorationItem>(
    `SELECT * FROM UnknownTerritory
     WHERE status = 'untested' AND risk_level = 'low'
     ORDER BY RANDOM()
     LIMIT 1`
  );
}

// ─── Log the result of an experiment ─────────────────────────────────────────

export function recordExperimentOutcome(
  id: number,
  status: "tried" | "approved" | "rejected",
  outcome?: string
): void {
  run(
    `UPDATE UnknownTerritory
     SET status = ?, outcome = ?, tried_at = datetime('now')
     WHERE id = ?`,
    [status, outcome ?? null, id]
  );
  saveDb();
  log("info", "experiment", `Experiment #${id} marked as ${status}`, { outcome });
}

// ─── Add new experiment ───────────────────────────────────────────────────────

export function addExperiment(
  description: string,
  type: string,
  risk_level: "low" | "medium" | "high" = "low"
): number {
  run(
    `INSERT INTO UnknownTerritory (description, type, risk_level) VALUES (?, ?, ?)`,
    [description, type, risk_level]
  );
  const row = queryOne<{ id: number }>("SELECT last_insert_rowid() as id");
  saveDb();
  log("info", "experiment", `New experiment added: ${description}`);
  return row?.id ?? 0;
}

// ─── Should inject exploration into this outfit? (10% rule) ──────────────────

export function shouldExplore(): boolean {
  // 10% chance on any given outfit generation
  return Math.random() < 0.1;
}
