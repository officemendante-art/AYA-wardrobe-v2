/**
 * AYA OS v1.0 — Knowledge Compiler
 * Reads source documents and populates the Rules, Identity, and Research tables.
 * Safe to re-run — uses INSERT OR IGNORE / deduplication.
 */

import fs from "fs";
import path from "path";
import { run, queryOne, saveDb, log, bumpKnowledgeVersion } from "../db.js";

// ─── Parse markdown into rule blocks ──────────────────────────────────────────

function extractRulesFromMarkdown(content: string, layer: string, source: string): number {
  let count = 0;
  // Extract bullet points and numbered lists
  const ruleMatches = content.match(/^[-*•]\s+.+$/gm) ?? [];
  const numberedMatches = content.match(/^\d+\.\s+.+$/gm) ?? [];
  const allRules = [...ruleMatches, ...numberedMatches];

  for (const rule of allRules) {
    const cleanRule = rule.replace(/^[-*•\d.]\s+/, "").trim();
    if (cleanRule.length < 10) continue;

    // Check for duplicate
    const exists = queryOne("SELECT id FROM Rules WHERE rule = ?", [cleanRule]);
    if (!exists) {
      run(
        "INSERT INTO Rules (layer, rule, source, priority) VALUES (?, ?, ?, 5)",
        [layer, cleanRule, source]
      );
      count++;
    }
  }
  return count;
}

// ─── Compile Identity Lock markdown ───────────────────────────────────────────

export function compileIdentityLock(filePath: string): number {
  if (!fs.existsSync(filePath)) return 0;
  const content = fs.readFileSync(filePath, "utf8");
  const source = path.basename(filePath);

  // Extract identity philosophy (first few paragraphs)
  const lines = content.split("\n").filter(Boolean);
  const philosophy = lines
    .filter((l) => !l.startsWith("#") && !l.startsWith("-") && l.length > 20)
    .slice(0, 5)
    .join(" ");

  if (philosophy) {
    run(
      "UPDATE Identity SET style_philosophy = ?, updated_at = datetime('now') WHERE id = 1",
      [philosophy]
    );
  }

  // Extract rules by section
  const sections = content.split(/^#{1,3}\s+/m);
  let count = 0;
  for (const section of sections) {
    const lower = section.toLowerCase();
    const layer = lower.includes("body") ? "body" :
                  lower.includes("color") ? "color" :
                  lower.includes("fabric") || lower.includes("material") ? "fabric" :
                  lower.includes("fit") ? "body" : "identity";
    count += extractRulesFromMarkdown(section, layer, source);
  }

  log("success", "system", `Identity Lock compiled: ${count} rules from ${source}`);
  return count;
}

// ─── Compile color system markdown ────────────────────────────────────────────

export function compileColorSystem(filePath: string): number {
  if (!fs.existsSync(filePath)) return 0;
  const content = fs.readFileSync(filePath, "utf8");
  const source = path.basename(filePath);
  const count = extractRulesFromMarkdown(content, "color", source);
  log("success", "system", `Color system compiled: ${count} rules from ${source}`);
  return count;
}

// ─── Compile research markdown ────────────────────────────────────────────────

export function compileResearchMarkdown(filePath: string, title?: string): number {
  if (!fs.existsSync(filePath)) return 0;
  const content = fs.readFileSync(filePath, "utf8");
  const source = path.basename(filePath);
  const resolvedTitle = title ?? source.replace(/\.md$/, "").replace(/_/g, " ");

  const exists = queryOne("SELECT id FROM Research WHERE source = ?", [source]);
  if (!exists) {
    run(
      "INSERT INTO Research (title, source, content, source_type) VALUES (?, ?, ?, 'document')",
      [resolvedTitle, source, content]
    );
  }
  log("success", "system", `Research compiled: ${source}`);
  return 1;
}

// ─── Compile plain text (extracted DOCX) ──────────────────────────────────────

export function compilePlainText(filePath: string, title: string): number {
  if (!fs.existsSync(filePath)) return 0;
  const content = fs.readFileSync(filePath, "utf8");
  const source = path.basename(filePath);

  // Extract rules by looking for capitalized phrases with colons or dashes
  const ruleLines = content.split("\n").filter((l) => {
    const trimmed = l.trim();
    return trimmed.length > 15 && (
      trimmed.includes(":") || trimmed.startsWith("-") || /^[A-Z]/.test(trimmed)
    );
  });

  // Store as research
  const exists = queryOne("SELECT id FROM Research WHERE source = ?", [source]);
  if (!exists) {
    run(
      "INSERT INTO Research (title, source, content, source_type) VALUES (?, ?, ?, 'document')",
      [title, source, content]
    );
  }

  log("success", "system", `Plain text compiled: ${title} — ${ruleLines.length} potential rules found`);
  return 1;
}

// ─── Compile JSON knowledge files ─────────────────────────────────────────────

export function compileColorGuidebook(filePath: string): number {
  if (!fs.existsSync(filePath)) return 0;
  const raw = fs.readFileSync(filePath, "utf8");
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return 0; }

  // Store the guidebook as research
  const source = path.basename(filePath);
  const exists = queryOne("SELECT id FROM Research WHERE source = ?", [source]);
  if (!exists) {
    run(
      "INSERT INTO Research (title, source, content, source_type, tags) VALUES (?, ?, ?, 'document', ?)",
      ["Color Guidebook", source, JSON.stringify(data, null, 2), JSON.stringify(["color", "palette", "guidelines"])]
    );
  }

  log("success", "system", "Color guidebook compiled");
  return 1;
}

export function compileModelCore(filePath: string): number {
  if (!fs.existsSync(filePath)) return 0;
  const raw = fs.readFileSync(filePath, "utf8");
  let data: any;
  try { data = JSON.parse(raw); } catch { return 0; }

  // Extract identity fields if present
  if (data.name) run("UPDATE Identity SET name = ? WHERE id = 1", [data.name]);
  if (data.body_type) run("UPDATE Identity SET body_type = ? WHERE id = 1", [data.body_type]);
  if (data.height_cm) run("UPDATE Identity SET height_cm = ? WHERE id = 1", [data.height_cm]);
  if (data.skin_tone) run("UPDATE Identity SET skin_tone = ? WHERE id = 1", [data.skin_tone]);

  log("success", "system", "Model core compiled into Identity");
  return 1;
}

// ─── Seed Google Flow Archive entries (filenames only — no analysis yet) ───────

export function seedFlowArchive(flowDir: string): number {
  if (!fs.existsSync(flowDir)) return 0;
  const files = fs.readdirSync(flowDir).filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f));
  let count = 0;

  for (const filename of files) {
    const id = `FLOW-${path.basename(filename, path.extname(filename)).replace(/[^a-zA-Z0-9]/g, "_").toUpperCase()}`;
    const imagePath = path.join(flowDir, filename).replace(/\\/g, "/");
    const exists = queryOne("SELECT id FROM FlowArchive WHERE id = ?", [id]);
    if (!exists) {
      run(
        "INSERT INTO FlowArchive (id, filename, image_path) VALUES (?, ?, ?)",
        [id, filename, imagePath]
      );
      count++;
    }
  }

  saveDb();
  log("success", "system", `Flow Archive seeded: ${count} entries`);
  return count;
}

// ─── Seed Unknown Territory from known gaps in the wardrobe ──────────────────

export function seedUnknownTerritory(): void {
  const items = [
    { description: "Try a solid terracotta or burnt sienna shirt", type: "color", risk_level: "low" },
    { description: "Try a textured linen blazer over a tee", type: "combination", risk_level: "low" },
    { description: "Try cream / off-white trousers in a formal setting", type: "color", risk_level: "medium" },
    { description: "Try a printed shirt (minimal block print) instead of solid", type: "fabric", risk_level: "medium" },
    { description: "Try layering a lightweight shirt under a kurta jacket", type: "silhouette", risk_level: "low" },
    { description: "Try white sneakers with a smart-casual outfit", type: "combination", risk_level: "low" },
    { description: "Try accessorizing with a minimalist bracelet", type: "accessory", risk_level: "low" },
    { description: "Try a relaxed-fit linen shirt in monsoon season", type: "fabric", risk_level: "low" },
    { description: "Try a half-tuck styling technique with a longer shirt", type: "silhouette", risk_level: "low" },
    { description: "Try a rich burgundy shade in evening wear", type: "color", risk_level: "medium" },
  ];

  for (const item of items) {
    const exists = queryOne("SELECT id FROM UnknownTerritory WHERE description = ?", [item.description]);
    if (!exists) {
      run(
        "INSERT INTO UnknownTerritory (description, type, risk_level) VALUES (?, ?, ?)",
        [item.description, item.type, item.risk_level]
      );
    }
  }
  saveDb();
  log("success", "system", "Unknown Territory seeded");
}

// ─── Run full compilation ──────────────────────────────────────────────────────

export async function runKnowledgeCompiler(basePath: string): Promise<{
  rules: number;
  research: number;
  flowEntries: number;
}> {
  log("info", "system", "Knowledge Compiler started");

  const join = (...parts: string[]) => path.join(basePath, ...parts);
  let rules = 0;
  let research = 0;

  rules += compileIdentityLock(join("AYA_IDENTITY_LOCK_V1.md"));
  rules += compileColorSystem(join("AYA_COLOR_SYSTEM_V1.md"));
  research += compileResearchMarkdown(join("AYA_OUTFIT_LIBRARY_V1.md"), "AYA Outfit Library V1");
  research += compileResearchMarkdown(join("POSE_ENVIRONMENT_LIBRARY_V1.md"), "Pose & Environment Library");
  research += compileResearchMarkdown(join("Chat gpt research outift.md"), "ChatGPT Research: Outfits");
  research += compileResearchMarkdown(join("knowledge_architecture.md"), "Knowledge Architecture");
  research += compileColorGuidebook(join("color_guidebook.json"));
  research += compileModelCore(join("model_core.json"));

  const extractedText = join("Wardrobe_Brain_extracted", "extracted_text.txt");
  research += compilePlainText(extractedText, "AYA Wardrobe Brain");

  const flowDir = join("data", "images", "flow");
  const flowEntries = seedFlowArchive(flowDir);

  seedUnknownTerritory();
  bumpKnowledgeVersion();

  // Record sources
  const sourceFiles = [
    "AYA_IDENTITY_LOCK_V1.md", "AYA_COLOR_SYSTEM_V1.md",
    "AYA_OUTFIT_LIBRARY_V1.md", "color_guidebook.json", "model_core.json",
  ];
  for (const f of sourceFiles) {
    const exists = queryOne("SELECT id FROM KnowledgeSources WHERE filename = ?", [f]);
    if (!exists) {
      run(
        "INSERT INTO KnowledgeSources (filename, source_type, status, ingested_at) VALUES (?, 'md', 'done', datetime('now'))",
        [f]
      );
    }
  }

  saveDb();
  log("success", "system", `Knowledge Compiler complete: ${rules} rules, ${research} research entries, ${flowEntries} flow archive entries`);

  return { rules, research, flowEntries };
}
