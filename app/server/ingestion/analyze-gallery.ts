import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";
import { run, queryOne, queryAll, saveDb, log } from "../db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function extractGalleryData(
  mimeType: string,
  base64Data: string,
  apiKey: string
): Promise<Record<string, unknown>> {
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: [
      { inlineData: { mimeType, data: base64Data } },
      {
        text: `You are AYA's AI fashion curator. Analyze this full outfit photo.
        
IMPORTANT:
- Focus on the overall mood, style, and context of the image.
- Do NOT guess the fabric. This must be left out.
- Extract the primary and secondary colors of the whole outfit.
- Identify the number of layers and the specific category items visible.
- Provide a brief styling DNA or notes summary.

Return a single JSON object adhering exactly to the schema.`
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "A descriptive title based on mood/context (e.g. 'Coffee Run in Linen', 'Minimalist Winter Walk')" },
          occasion: { type: Type.STRING, description: "casual | smart_casual | formal | business | festive | travel | beach | wedding | lounge" },
          season: { type: Type.STRING, description: "summer | winter | spring | autumn | all" },
          style: { type: Type.STRING, description: "minimalist | streetwear | classic | avant_garde | preppy | rugged | athleisure" },
          primary_colors: { type: Type.STRING, description: "Comma separated list of primary colors visible (e.g. 'navy blue, olive green')" },
          secondary_colors: { type: Type.STRING, description: "Comma separated list of secondary/accent colors visible" },
          fit: { type: Type.STRING, description: "slim | tailored | relaxed | oversized | mixed" },
          notes: { type: Type.STRING, description: "Short summary of the outfit's DNA, vibe, or key styling choices." },
          layer_count: { type: Type.NUMBER, description: "Number of main clothing layers visible (e.g. 1 for just a shirt, 2 for shirt+jacket)" },
          category_items: { type: Type.STRING, description: "Comma separated list of visible items (e.g. 'shirt, overshirt, trousers, boots')" }
        },
        required: ["title", "occasion", "season", "style", "primary_colors", "secondary_colors", "fit", "notes", "layer_count", "category_items"]
      }
    }
  });

  try {
    return JSON.parse(response.text?.trim() ?? "{}");
  } catch {
    throw new Error("Gemini returned malformed JSON. Please retry the analysis.");
  }
}

export async function analyzeGalleryOutfit(id: string, apiKey: string) {
  const imgRow = queryOne<{ image_path: string }>("SELECT image_path FROM GalleryImages WHERE id = ?", [id]);
  if (!imgRow) throw new Error("Image not found");

  const absolutePath = path.resolve(__dirname, "../../", imgRow.image_path);
  if (!fs.existsSync(absolutePath)) throw new Error("Image file missing: " + absolutePath);

  const ext = path.extname(absolutePath).toLowerCase().replace(".", "") || "jpg";
  const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  const base64Data = fs.readFileSync(absolutePath).toString("base64");

  const data = await extractGalleryData(mimeType, base64Data, apiKey);

  const dnaSummary = JSON.stringify({
    layers: data.layer_count,
    items: data.category_items
  });

  run(
    `UPDATE GalleryImages SET 
      title = ?, occasion = ?, season = ?, style = ?, 
      primary_colors = ?, secondary_colors = ?, fit = ?, notes = ?, dna = ?
    WHERE id = ?`,
    [
      data.title, data.occasion, data.season, data.style, 
      data.primary_colors, data.secondary_colors, data.fit, data.notes, dnaSummary,
      id
    ]
  );
  saveDb();
  
  log("success", "ai", `Gallery image analyzed: ${id}`);
  return data;
}

export async function runGalleryBatchAnalysis(jobId: number, apiKey: string) {
  try {
    run("UPDATE Jobs SET status = 'running', started_at = datetime('now') WHERE id = ?", [jobId]);
    
    const images = queryAll<{ id: string }>("SELECT id FROM GalleryImages WHERE occasion IS NULL");
    
    run("UPDATE Jobs SET total_items = ?, done_items = 0 WHERE id = ?", [images.length, jobId]);
    
    let done = 0;
    for (const img of images) {
      try {
        await analyzeGalleryOutfit(img.id, apiKey);
      } catch (e) {
        log("error", "ai", `Failed to analyze gallery image ${img.id}: ${e}`);
      }
      done++;
      const progress = Math.floor((done / images.length) * 100);
      run("UPDATE Jobs SET done_items = ?, progress = ? WHERE id = ?", [done, progress, jobId]);
    }
    
    run("UPDATE Jobs SET status = 'done', progress = 100, finished_at = datetime('now') WHERE id = ?", [jobId]);
    saveDb();
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    run("UPDATE Jobs SET status = 'failed', error = ?, finished_at = datetime('now') WHERE id = ?", [errorMsg, jobId]);
    saveDb();
  }
}
