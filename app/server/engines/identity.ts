/**
 * AYA OS v1.0 — Identity Engine
 * Reads Identity + Rules tables to produce constraints for any AI prompt.
 */

import { queryAll, queryOne } from "../db.js";

export interface IdentityProfile {
  name: string;
  body_type: string;
  height_cm: number;
  skin_tone: string;
  skin_undertone: string;
  style_philosophy: string;
}

export interface LayerRules {
  identity: string[];
  body: string[];
  color: string[];
  fabric: string[];
  style: string[];
  occasion: string[];
  shopping: string[];
}

export function getIdentity(): IdentityProfile | null {
  return queryOne<IdentityProfile>("SELECT * FROM Identity WHERE id = 1");
}

export function getRules(layer?: string): LayerRules {
  const rows = queryAll<{ layer: string; rule: string; priority: number }>(
    layer
      ? "SELECT layer, rule, priority FROM Rules WHERE active = 1 AND layer = ? ORDER BY priority ASC"
      : "SELECT layer, rule, priority FROM Rules WHERE active = 1 ORDER BY priority ASC",
    layer ? [layer] : []
  );

  const map: LayerRules = {
    identity: [], body: [], color: [], fabric: [],
    style: [], occasion: [], shopping: [],
  };

  for (const row of rows) {
    const key = row.layer as keyof LayerRules;
    if (key in map) map[key].push(row.rule);
  }
  return map;
}

export function buildIdentityContext(): string {
  const identity = getIdentity();
  const rules = getRules();

  const lines: string[] = [
    "=== AYA IDENTITY LOCK ===",
    identity
      ? `Owner: ${identity.name || "AYA"} | Body: ${identity.body_type || "unknown"} | Skin: ${identity.skin_tone || "unknown"} (${identity.skin_undertone || "unknown"} undertone)`
      : "Identity not configured.",
    identity?.style_philosophy ? `Philosophy: ${identity.style_philosophy}` : "",
    "",
    "=== IDENTITY RULES ===",
    ...rules.identity.map((r) => `• ${r}`),
    "",
    "=== BODY RULES ===",
    ...rules.body.map((r) => `• ${r}`),
    "",
    "=== COLOR RULES ===",
    ...rules.color.map((r) => `• ${r}`),
    "",
    "=== FABRIC RULES ===",
    ...rules.fabric.map((r) => `• ${r}`),
    "",
    "=== STYLE RULES ===",
    ...rules.style.map((r) => `• ${r}`),
  ];

  return lines.filter(Boolean).join("\n");
}
