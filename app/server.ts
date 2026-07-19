/**
 * AYA FASHION INTELLIGENCE OS v1.0 — Main Server
 * Express + Vite dev middleware + Gemini API + SQLite
 */

import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Database ─────────────────────────────────────────────────────────────────
import { initDb, queryAll, queryOne, run, saveDb, log, backupDb, getSchemaVersion } from "./server/db.js";

// ─── Engines ──────────────────────────────────────────────────────────────────
import { generateOutfit } from "./server/engines/decision.js";
import { getGarmentDNA, getOutfitDNA } from "./server/engines/dna.js";

// ─── Ingestion ────────────────────────────────────────────────────────────────
import { analyzeGarment } from "./server/ingestion/analyze-garment.js";
import { runKnowledgeCompiler } from "./server/ingestion/compile-knowledge.js";

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function startServer() {
  // Initialize DB first
  await initDb();
  log("info", "system", "AYA OS v1.0 server starting");

  // ─── MIGRATIONS ─────────────────────────────────────────────────────────────
  try {
    run("DROP TABLE IF EXISTS ReviewQueue");
    run("DROP TABLE IF EXISTS Shopping");
    run("DROP TABLE IF EXISTS UnknownTerritory");
    
    const hasFlow = queryOne<{cnt: number}>("SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name='FlowArchive'");
    if (hasFlow?.cnt) {
      log("info", "system", "Migrating FlowArchive to GalleryImages...");
      const archives = queryAll<any>("SELECT * FROM FlowArchive");
      for (const flow of archives) {
        const existing = queryOne("SELECT id FROM GalleryImages WHERE title = ? AND source = 'Google Flow'", [flow.filename]);
        if (!existing) {
          run(`INSERT INTO GalleryImages (id, title, image_path, notes, source, created_at)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [flow.id, flow.filename, flow.image_path, flow.ai_description, 'Google Flow', flow.created_at]);
        }
      }
      run("DROP TABLE IF EXISTS FlowDNA");
      run("DROP TABLE IF EXISTS FlowArchive");
      saveDb();
      log("success", "system", "Migration complete.");
    }
    
    // ─── DATA CLEANUP: Remove any GalleryImages with broken absolute paths ───
    const brokenCount = (queryOne<{ cnt: number }>("SELECT COUNT(*) as cnt FROM GalleryImages WHERE image_path LIKE 'C:%' OR image_path LIKE '/Users/%'"))?.cnt ?? 0;
    if (brokenCount > 0) {
      run("DELETE FROM GalleryImages WHERE image_path LIKE 'C:%' OR image_path LIKE '/Users/%'");
      saveDb();
      log("success", "system", `Cleaned ${brokenCount} gallery records with invalid absolute paths.`);
    }
  } catch(e) {
    console.error("Migration error:", e);
  }

  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Serve wardrobe images from data/images
  app.use("/data/images", express.static(path.join(__dirname, "data/images")));

  // ─── HELPER ────────────────────────────────────────────────────────────────

  function getApiKey(req: express.Request): string {
    let key = process.env.GEMINI_API_KEY;
    if (!key) {
      const dbRow = queryOne<{ value: string }>("SELECT value FROM Settings WHERE key = 'gemini_api_key'");
      key = dbRow?.value;
    }
    if (!key) throw new Error("GEMINI_API_KEY environment variable not configured.");
    return key;
  }

  function handleError(res: express.Response, err: unknown, context: string) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[AYA] ${context}:`, msg);
    log("error", "system", `${context}: ${msg}`);
    res.status(500).json({ error: msg, context });
  }

  // ─── SYSTEM ────────────────────────────────────────────────────────────────

  // GET /api/status — System health
  app.get("/api/status", (_req, res) => {
    try {
      const counts = {
        garments:       (queryOne<{ n: number }>("SELECT COUNT(*) as n FROM Garments WHERE deleted = 0 AND archived = 0"))?.n ?? 0,
        colors:         (queryOne<{ n: number }>("SELECT COUNT(DISTINCT name) as n FROM Colors"))?.n ?? 0,
        outfits:        (queryOne<{ n: number }>("SELECT COUNT(*) as n FROM Outfits"))?.n ?? 0,
        rules:          (queryOne<{ n: number }>("SELECT COUNT(*) as n FROM Rules WHERE active = 1"))?.n ?? 0,
        research:       (queryOne<{ n: number }>("SELECT COUNT(*) as n FROM Research"))?.n ?? 0,
        gallery:        (queryOne<{ n: number }>("SELECT COUNT(*) as n FROM GalleryImages"))?.n ?? 0,
        fabrics:        (queryOne<{ n: number }>("SELECT COUNT(DISTINCT value) as n FROM Attributes WHERE key = 'fabric'"))?.n ?? 0,
      };
      const schema = getSchemaVersion();
      res.json({ status: "healthy", counts, schema, timestamp: new Date().toISOString() });
    } catch (e) { handleError(res, e, "status"); }
  });

  // GET /api/settings — App settings
  app.get("/api/settings", (_req, res) => {
    try {
      const rows = queryAll<{ key: string; value: string }>("SELECT key, value FROM Settings");
      const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      res.json(settings);
    } catch (e) { handleError(res, e, "get-settings"); }
  });

  // PUT /api/settings — Update settings
  app.put("/api/settings", (req, res) => {
    try {
      const updates = req.body as Record<string, string>;
      for (const [key, value] of Object.entries(updates)) {
        run("INSERT INTO Settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')", [key, value]);
      }
      saveDb();
      res.json({ success: true });
    } catch (e) { handleError(res, e, "put-settings"); }
  });

  // GET /api/identity — Identity profile
  app.get("/api/identity", (_req, res) => {
    try {
      const identity = queryOne("SELECT * FROM Identity WHERE id = 1");
      res.json(identity ?? {});
    } catch (e) { handleError(res, e, "get-identity"); }
  });

  // PUT /api/identity — Update identity
  app.put("/api/identity", (req, res) => {
    try {
      const { name, body_type, height_cm, skin_tone, skin_undertone, style_philosophy } = req.body;
      run(
        "UPDATE Identity SET name=?, body_type=?, height_cm=?, skin_tone=?, skin_undertone=?, style_philosophy=?, updated_at=datetime('now') WHERE id=1",
        [name, body_type, height_cm, skin_tone, skin_undertone, style_philosophy]
      );
      saveDb();
      log("info", "system", "Identity profile updated");
      res.json({ success: true });
    } catch (e) { handleError(res, e, "put-identity"); }
  });

  // ─── GARMENTS ──────────────────────────────────────────────────────────────

  // POST /api/analyze — Analyze garment image
  app.post("/api/analyze", async (req, res) => {
    try {
      const { image, context } = req.body;
      if (!image) return res.status(400).json({ error: "image is required" });

      // Validate image size
      const sizeKb = Math.round(image.length * 0.75 / 1024);
      if (sizeKb > 20_000) return res.status(413).json({ error: "Image too large (max 20MB)" });

      const apiKey = getApiKey(req);
      const result = await analyzeGarment(image, context ?? "", apiKey);

      // Save image file
      if (image && result.garmentId) {
        const ext = image.match(/^data:image\/(\w+)/)?.[1] ?? "jpg";
        const imgPath = path.join(__dirname, "data/images", `${result.garmentId}.${ext}`);
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
        fs.mkdirSync(path.dirname(imgPath), { recursive: true });
        fs.writeFileSync(imgPath, Buffer.from(base64Data, "base64"));
        run("UPDATE Garments SET image_path = ? WHERE id = ?", [`data/images/${result.garmentId}.${ext}`, result.garmentId]);
        saveDb();
      }

      res.json(result);
    } catch (e) { handleError(res, e, "analyze"); }
  });

  // GET /api/wardrobe — All garments
  app.get("/api/wardrobe", (_req, res) => {
    try {
      const garments = queryAll(
        "SELECT * FROM Garments WHERE deleted = 0 ORDER BY created_at DESC"
      );
      // Enrich each garment with colors and attributes
      const enriched = garments.map((g: any) => {
        const colors = queryAll("SELECT * FROM Colors WHERE garment_id = ?", [g.id]);
        const attrs = queryAll("SELECT key, value, confidence FROM Attributes WHERE garment_id = ?", [g.id]);
        const dna = queryAll("SELECT dimension, score FROM GarmentDNA WHERE garment_id = ?", [g.id]);
        return { ...g, colors, attributes: attrs, dna };
      });
      res.json(enriched);
    } catch (e) { handleError(res, e, "get-wardrobe"); }
  });

  // GET /api/wardrobe/:id — Single garment
  app.get("/api/wardrobe/:id", (req, res) => {
    try {
      const garment = queryOne("SELECT * FROM Garments WHERE id = ?", [req.params.id]);
      if (!garment) return res.status(404).json({ error: "Garment not found" });
      const colors = queryAll("SELECT * FROM Colors WHERE garment_id = ?", [req.params.id]);
      const attrs = queryAll("SELECT * FROM Attributes WHERE garment_id = ?", [req.params.id]);
      const dna = queryAll("SELECT dimension, score FROM GarmentDNA WHERE garment_id = ?", [req.params.id]);
      res.json({ ...garment, colors, attributes: attrs, dna });
    } catch (e) { handleError(res, e, "get-garment"); }
  });

  // PATCH /api/wardrobe/:id — Update garment fields
  app.patch("/api/wardrobe/:id", (req, res) => {
    try {
      const { item_name, category, type, collar_type, sleeve_type, texture, visual_weight, luxury_score, minimalism_score } = req.body;
      run(
        `UPDATE Garments SET item_name=COALESCE(?,item_name), category=COALESCE(?,category), type=COALESCE(?,type),
         collar_type=COALESCE(?,collar_type), sleeve_type=COALESCE(?,sleeve_type), texture=COALESCE(?,texture),
         visual_weight=COALESCE(?,visual_weight), luxury_score=COALESCE(?,luxury_score),
         minimalism_score=COALESCE(?,minimalism_score), modified_at=datetime('now') WHERE id=?`,
        [item_name, category, type, collar_type, sleeve_type, texture, visual_weight, luxury_score, minimalism_score, req.params.id]
      );
      log("info", "garment", `Garment updated: ${req.params.id}`);
      saveDb();
      res.json({ success: true });
    } catch (e) { handleError(res, e, "patch-garment"); }
  });

  // DELETE /api/wardrobe/:id — Soft delete
  app.delete("/api/wardrobe/:id", (req, res) => {
    try {
      run("UPDATE Garments SET deleted = 1, modified_at = datetime('now') WHERE id = ?", [req.params.id]);
      log("info", "garment", `Garment soft-deleted: ${req.params.id}`);
      saveDb();
      res.json({ success: true });
    } catch (e) { handleError(res, e, "delete-garment"); }
  });

  // POST /api/wardrobe/:id/archive
  app.post("/api/wardrobe/:id/archive", (req, res) => {
    try {
      run("UPDATE Garments SET archived = 1, modified_at = datetime('now') WHERE id = ?", [req.params.id]);
      log("info", "garment", `Garment archived: ${req.params.id}`);
      saveDb();
      res.json({ success: true });
    } catch (e) { handleError(res, e, "archive-garment"); }
  });

  // ─── OUTFITS ────────────────────────────────────────────────────────────────

  // POST /api/outfit/generate — Decision Engine
  app.post("/api/outfit/generate", async (req, res) => {
    try {
      const context = req.body;
      if (!context.occasion) return res.status(400).json({ error: "occasion is required" });
      const apiKey = getApiKey(req);
      const result = await generateOutfit(context, apiKey);
      res.json(result);
    } catch (e) { handleError(res, e, "outfit-generate"); }
  });

  // GET /api/outfits — Outfit history
  app.get("/api/outfits", (_req, res) => {
    try {
      const outfits = queryAll("SELECT * FROM Outfits ORDER BY created_at DESC LIMIT 50");
      res.json(outfits);
    } catch (e) { handleError(res, e, "get-outfits"); }
  });

  // GET /api/outfit/:id — Single outfit with items
  app.get("/api/outfit/:id", (req, res) => {
    try {
      const outfit = queryOne("SELECT * FROM Outfits WHERE id = ?", [req.params.id]);
      if (!outfit) return res.status(404).json({ error: "Outfit not found" });
      const items = queryAll(
        `SELECT oi.role, g.id, g.item_name, g.category, g.image_path
         FROM OutfitItems oi JOIN Garments g ON oi.garment_id = g.id
         WHERE oi.outfit_id = ?`, [req.params.id]
      );
      const dna = queryAll("SELECT dimension, score FROM OutfitDNA WHERE outfit_id = ?", [req.params.id]);
      res.json({ ...outfit, items, dna });
    } catch (e) { handleError(res, e, "get-outfit"); }
  });

  // ─── INTERACTIONS ───────────────────────────────────────────────────────────

  // POST /api/interaction — Log user action
  app.post("/api/interaction", (req, res) => {
    try {
      const { entity_type, entity_id, action, context, notes } = req.body;
      if (!entity_type || !entity_id || !action) return res.status(400).json({ error: "entity_type, entity_id, action required" });
      run(
        "INSERT INTO Interactions (entity_type, entity_id, action, context, notes) VALUES (?, ?, ?, ?, ?)",
        [entity_type, entity_id, action, context ? JSON.stringify(context) : null, notes ?? null]
      );
      log("info", entity_type, `Interaction logged: ${action} on ${entity_id}`);
      saveDb();
      res.json({ success: true });
    } catch (e) { handleError(res, e, "interaction"); }
  });

  // ─── GALLERY & COLLECTIONS ──────────────────────────────────────────────────

  // GET /api/gallery
  app.get("/api/gallery", (_req, res) => {
    try {
      const images = queryAll("SELECT * FROM GalleryImages WHERE image_path NOT LIKE 'C:%' AND image_path NOT LIKE '/Users/%' ORDER BY created_at DESC");
      res.json(images);
    } catch (e) { handleError(res, e, "get-gallery"); }
  });

  // POST /api/gallery — Upload a new outfit image
  app.post("/api/gallery", (req, res) => {
    try {
      const { image, title } = req.body;
      if (!image) return res.status(400).json({ error: "No image provided" });
      const id = `UPLOAD-${Date.now()}`;
      const ext = image.match(/^data:image\/(\w+)/)?.[1] ?? "jpg";
      const imgDir = path.join(__dirname, "data/images/uploads");
      fs.mkdirSync(imgDir, { recursive: true });
      const imgPath = path.join(imgDir, `${id}.${ext}`);
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      fs.writeFileSync(imgPath, Buffer.from(base64Data, "base64"));
      const relativePath = `data/images/uploads/${id}.${ext}`;
      run(
        "INSERT INTO GalleryImages (id, title, image_path, source, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
        [id, title || "Uploaded Outfit", relativePath, "upload"]
      );
      saveDb();
      res.json({ success: true, id, image_path: relativePath });
    } catch (e) { handleError(res, e, "post-gallery"); }
  });


  // GET /api/collections
  app.get("/api/collections", (_req, res) => {
    try {
      const collections = queryAll("SELECT * FROM Collections ORDER BY name ASC");
      res.json(collections);
    } catch (e) { handleError(res, e, "get-collections"); }
  });

  // POST /api/collections
  app.post("/api/collections", (req, res) => {
    try {
      const id = `col_${Date.now()}`;
      run("INSERT INTO Collections (id, name, description) VALUES (?, ?, ?)", [id, req.body.name, req.body.description ?? ""]);
      saveDb();
      res.json({ success: true, id });
    } catch (e) { handleError(res, e, "post-collections"); }
  });

  // ─── RULES ──────────────────────────────────────────────────────────────────

  // GET /api/rules
  app.get("/api/rules", (_req, res) => {
    try {
      const layer = _req.query.layer as string | undefined;
      const rows = layer
        ? queryAll("SELECT * FROM Rules WHERE layer = ? AND active = 1 ORDER BY priority", [layer])
        : queryAll("SELECT * FROM Rules WHERE active = 1 ORDER BY layer, priority");
      res.json(rows);
    } catch (e) { handleError(res, e, "get-rules"); }
  });

  // ─── RESEARCH ───────────────────────────────────────────────────────────────

  // GET /api/research
  app.get("/api/research", (_req, res) => {
    try {
      const rows = queryAll("SELECT id, title, source, source_type, tags, ingested_at FROM Research ORDER BY ingested_at DESC");
      res.json(rows);
    } catch (e) { handleError(res, e, "get-research"); }
  });

  // ─── ACTIVITY LOG ───────────────────────────────────────────────────────────

  // GET /api/activity — Recent activity log
  app.get("/api/activity", (_req, res) => {
    try {
      const limit = Number(_req.query.limit ?? 100);
      const rows = queryAll(
        "SELECT * FROM ActivityLog ORDER BY timestamp DESC LIMIT ?",
        [limit]
      );
      res.json(rows);
    } catch (e) { handleError(res, e, "get-activity"); }
  });

  // ─── KNOWLEDGE COMPILER ─────────────────────────────────────────────────────

  // POST /api/compile — Run knowledge compiler
  app.post("/api/compile", async (_req, res) => {
    try {
      const basePath = path.resolve(__dirname, "../");
      const result = await runKnowledgeCompiler(basePath);
      res.json({ success: true, ...result });
    } catch (e) { handleError(res, e, "compile"); }
  });

  // ─── BACKUP / RESTORE ───────────────────────────────────────────────────────

  // POST /api/backup — Create backup
  app.post("/api/backup", (_req, res) => {
    try {
      const backupPath = backupDb();
      const filename = path.basename(backupPath);
      res.json({ success: true, path: backupPath, filename });
    } catch (e) { handleError(res, e, "backup"); }
  });

  // GET /api/backup/download/:filename — Download backup file
  app.get("/api/backup/download/:filename", (req, res) => {
    try {
      const filePath = path.join(__dirname, "data", req.params.filename);
      if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Backup not found" });
      res.download(filePath, req.params.filename);
    } catch (e) { handleError(res, e, "backup-download"); }
  });

  // ─── JOBS ───────────────────────────────────────────────────────────────────

  // GET /api/jobs — Job queue status
  app.get("/api/jobs", (_req, res) => {
    try {
      const rows = queryAll("SELECT * FROM Jobs ORDER BY created_at DESC LIMIT 20");
      res.json(rows);
    } catch (e) { handleError(res, e, "get-jobs"); }
  });

  // ─── ANALYTICS ──────────────────────────────────────────────────────────────

  // GET /api/analytics
  app.get("/api/analytics", (_req, res) => {
    try {
      const analytics = {
        avg_ai_confidence: queryOne<{ avg: number }>("SELECT AVG(ai_confidence_overall) as avg FROM Garments WHERE deleted = 0")?.avg?.toFixed(2),
        most_common_category: queryOne<{ category: string; cnt: number }>("SELECT category, COUNT(*) as cnt FROM Garments WHERE deleted = 0 GROUP BY category ORDER BY cnt DESC LIMIT 1"),
        most_common_color: queryOne<{ name: string; cnt: number }>("SELECT name, COUNT(*) as cnt FROM Colors WHERE role = 'primary' GROUP BY name ORDER BY cnt DESC LIMIT 1"),
        outfits_last_30_days: queryOne<{ cnt: number }>("SELECT COUNT(*) as cnt FROM Outfits WHERE created_at >= datetime('now', '-30 days')")?.cnt,
        unused_garments: queryOne<{ cnt: number }>("SELECT COUNT(*) as cnt FROM Garments g WHERE deleted = 0 AND archived = 0 AND NOT EXISTS (SELECT 1 FROM OutfitItems oi WHERE oi.garment_id = g.id)")?.cnt,
        avg_similarity: queryOne<{ avg: number }>("SELECT AVG(similarity_score) as avg FROM Outfits")?.avg?.toFixed(1),
      };
      res.json(analytics);
    } catch (e) { handleError(res, e, "get-analytics"); }
  });

  // ─── EXPORT ─────────────────────────────────────────────────────────────────

  // GET /api/export — Full wardrobe export as JSON
  app.get("/api/export", (_req, res) => {
    try {
      const garments = queryAll("SELECT * FROM Garments WHERE deleted = 0");
      const enriched = garments.map((g: any) => ({
        ...g,
        colors: queryAll("SELECT * FROM Colors WHERE garment_id = ?", [g.id]),
        attributes: queryAll("SELECT * FROM Attributes WHERE garment_id = ?", [g.id]),
        dna: queryAll("SELECT dimension, score FROM GarmentDNA WHERE garment_id = ?", [g.id]),
      }));
      res.json({
        exported_at: new Date().toISOString(),
        version: "AYA OS 1.0",
        garment_count: enriched.length,
        garments: enriched,
      });
    } catch (e) { handleError(res, e, "export"); }
  });

  // ─── VITE DEV MIDDLEWARE ─────────────────────────────────────────────────────

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🧠 AYA OS v1.0 running → http://localhost:${PORT}\n`);
    log("success", "system", `Server started on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
