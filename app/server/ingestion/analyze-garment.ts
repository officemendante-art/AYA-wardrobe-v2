/**
 * AYA OS v1.0 — Garment Ingestion
 * Extended Gemini Vision analysis for a single garment image.
 * Extracts 25+ attributes + full 17-dimension DNA.
 * Flags low-confidence fields for the Review Queue.
 */

import { GoogleGenAI, Type } from "@google/genai";
import { run, queryOne, saveDb, log } from "../db.js";
import { setGarmentDNA } from "../engines/dna.js";
import type { DNAVector } from "../engines/dna.js";
import { buildIdentityContext } from "../engines/identity.js";

const CONFIDENCE_REVIEW_THRESHOLD = 0.75;

// ─── Full garment analysis ─────────────────────────────────────────────────────

export async function analyzeGarment(
  imageDataUrl: string,
  userContext: string,
  apiKey: string
): Promise<{
  garmentId: string;
  metadata: Record<string, unknown>;
  reviewQueueCount: number;
  confidence: number;
}> {
  const matches = imageDataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
  if (!matches) throw new Error("Invalid image data URI format.");
  const [, mimeType, base64Data] = matches;

  const identityContext = buildIdentityContext();

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: [
      { inlineData: { mimeType, data: base64Data } },
      {
        text: `You are AYA's AI garment analyst. Analyze this clothing item with expert precision.

${identityContext}

IMPORTANT: Analyze this item ONLY based on visual evidence. For anything you cannot confirm visually, set confidence below 0.75 and status to "likely" or "unknown".

Return a single JSON object adhering exactly to the schema.
User context: "${userContext || "No additional context provided."}"`
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          item_name:  { type: Type.STRING, description: "Descriptive name e.g. 'Forest Olive Linen Shirt'" },
          category:   { type: Type.STRING, description: "tops | bottoms | outerwear | shoes | watches | eyewear | jewelry | bags | belts | accessories | unknown" },
          type:       { type: Type.STRING, description: "Specific type: shirt | trousers | jacket | kurta | polo | etc." },
          primary_color: {
            type: Type.OBJECT, properties: {
              name:       { type: Type.STRING },
              hex:        { type: Type.STRING },
              role:       { type: Type.STRING },
              confidence: { type: Type.NUMBER }
            }, required: ["name", "hex", "role", "confidence"]
          },
          secondary_colors: {
            type: Type.ARRAY, items: {
              type: Type.OBJECT, properties: {
                name: { type: Type.STRING }, hex: { type: Type.STRING },
                role: { type: Type.STRING }, confidence: { type: Type.NUMBER }
              }, required: ["name", "hex", "role", "confidence"]
            }
          },
          material:       { type: Type.OBJECT, properties: { value: { type: Type.STRING }, confidence: { type: Type.NUMBER }, status: { type: Type.STRING } }, required: ["value", "confidence", "status"] },
          pattern:        { type: Type.STRING },
          brand:          { type: Type.OBJECT, properties: { value: { type: Type.STRING }, confidence: { type: Type.NUMBER }, status: { type: Type.STRING } }, required: ["value", "confidence", "status"] },
          fit:            { type: Type.OBJECT, properties: { value: { type: Type.STRING }, confidence: { type: Type.NUMBER }, status: { type: Type.STRING } }, required: ["value", "confidence", "status"] },
          formality:      { type: Type.STRING },
          collar_type:    { type: Type.STRING, description: "button-down | spread | mandarin | crew | v-neck | polo | none | unknown" },
          sleeve_type:    { type: Type.STRING, description: "full | half | three-quarter | sleeveless | unknown" },
          buttons:        { type: Type.STRING, description: "none | front | partial | double-breasted | unknown" },
          texture:        { type: Type.STRING, description: "smooth | textured | ribbed | woven | knit | distressed | unknown" },
          visual_weight:  { type: Type.STRING, description: "light | medium | heavy" },
          layering_suitability: { type: Type.STRING, description: "base | mid | outer | standalone" },
          luxury_score:   { type: Type.NUMBER, description: "0-100 luxury feel score" },
          minimalism_score: { type: Type.NUMBER, description: "0-100 minimalism score" },
          photogenic_score: { type: Type.NUMBER, description: "0-100 photography suitability" },
          season:         { type: Type.ARRAY, items: { type: Type.STRING }, description: "summer | monsoon | winter | spring | all" },
          occasion_tags:  { type: Type.ARRAY, items: { type: Type.STRING }, description: "casual | smart_casual | formal | business | festive | travel | beach | wedding" },
          weather_suitability: { type: Type.ARRAY, items: { type: Type.STRING }, description: "sunny | cloudy | rainy | humid | hot | cold" },
          notes:          { type: Type.STRING },
          ai_confidence_overall: { type: Type.NUMBER },
          // Outfit DNA dimensions
          dna_authority:       { type: Type.NUMBER, description: "0-100" },
          dna_luxury:          { type: Type.NUMBER, description: "0-100" },
          dna_minimalism:      { type: Type.NUMBER, description: "0-100" },
          dna_warmth:          { type: Type.NUMBER, description: "0-100" },
          dna_confidence:      { type: Type.NUMBER, description: "0-100" },
          dna_creativity:      { type: Type.NUMBER, description: "0-100" },
          dna_professionalism: { type: Type.NUMBER, description: "0-100" },
          dna_visual_weight:   { type: Type.NUMBER, description: "0-100" },
          dna_contrast:        { type: Type.NUMBER, description: "0-100" },
          dna_texture:         { type: Type.NUMBER, description: "0-100" },
          dna_formality:       { type: Type.NUMBER, description: "0-100" },
          dna_traditional:     { type: Type.NUMBER, description: "0-100" },
          dna_modern:          { type: Type.NUMBER, description: "0-100" },
          dna_experimental:    { type: Type.NUMBER, description: "0-100" },
          dna_approachability: { type: Type.NUMBER, description: "0-100" },
          dna_photogenic:      { type: Type.NUMBER, description: "0-100" },
          dna_complexity:      { type: Type.NUMBER, description: "0-100" },
        },
        required: [
          "item_name", "category", "type", "primary_color", "secondary_colors",
          "material", "pattern", "brand", "fit", "formality", "season", "notes",
          "ai_confidence_overall",
          "dna_authority", "dna_luxury", "dna_minimalism", "dna_warmth",
          "dna_confidence", "dna_creativity", "dna_professionalism",
          "dna_visual_weight", "dna_contrast", "dna_texture", "dna_formality",
          "dna_traditional", "dna_modern", "dna_experimental",
          "dna_approachability", "dna_photogenic", "dna_complexity",
        ]
      }
    }
  });

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(response.text?.trim() ?? "{}");
  } catch {
    throw new Error("Gemini returned malformed JSON. Please retry the analysis.");
  }

  // Generate garment ID
  const category = String(data.category ?? "accessories");
  const prefix = ({
    tops: "TOP", bottoms: "BOTTOM", outerwear: "OUTER",
    shoes: "FOOT", watches: "WATCH", eyewear: "EYE",
    jewelry: "JEWEL", bags: "BAG", belts: "BELT",
  } as Record<string, string>)[category] ?? "ACC";

  const existing = queryOne<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM Garments WHERE id LIKE '${prefix}-%'`
  );
  const nextNum = String((existing?.cnt ?? 0) + 1).padStart(3, "0");
  const garmentId = `${prefix}-${nextNum}`;

  // Save core garment record
  run(
    `INSERT INTO Garments
     (id, item_name, category, type, collar_type, sleeve_type, buttons, texture,
      visual_weight, layering_suitability, luxury_score, minimalism_score,
      photogenic_score, ai_confidence_overall, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [
      garmentId,
      data.item_name, data.category, data.type,
      data.collar_type ?? null, data.sleeve_type ?? null, data.buttons ?? null,
      data.texture ?? null, data.visual_weight ?? null,
      data.layering_suitability ?? null,
      data.luxury_score ?? null, data.minimalism_score ?? null,
      data.photogenic_score ?? null, data.ai_confidence_overall,
    ]
  );

  // Save colors
  const primary = data.primary_color as any;
  if (primary) {
    run(
      "INSERT INTO Colors (garment_id, role, name, hex, confidence) VALUES (?, ?, ?, ?, ?)",
      [garmentId, "primary", primary.name, primary.hex, primary.confidence]
    );
  }
  for (const c of (data.secondary_colors as any[] ?? [])) {
    run(
      "INSERT INTO Colors (garment_id, role, name, hex, confidence) VALUES (?, ?, ?, ?, ?)",
      [garmentId, c.role ?? "secondary", c.name, c.hex, c.confidence]
    );
  }

  // Save key attributes
  const attrFields: Array<[string, unknown, number, string]> = [
    ["material", (data.material as any)?.value, (data.material as any)?.confidence ?? 1, (data.material as any)?.status ?? "known"],
    ["pattern", data.pattern, 1, "known"],
    ["fit", (data.fit as any)?.value, (data.fit as any)?.confidence ?? 1, (data.fit as any)?.status ?? "known"],
    ["brand", (data.brand as any)?.value, (data.brand as any)?.confidence ?? 1, (data.brand as any)?.status ?? "known"],
    ["formality", data.formality, 1, "known"],
  ];

  for (const seasonVal of (data.season as string[] ?? [])) {
    run("INSERT INTO Attributes (garment_id, key, value, confidence, status) VALUES (?, 'season', ?, 1, 'known')", [garmentId, seasonVal]);
  }
  for (const occ of (data.occasion_tags as string[] ?? [])) {
    run("INSERT INTO Attributes (garment_id, key, value, confidence, status) VALUES (?, 'occasion', ?, 1, 'known')", [garmentId, occ]);
  }
  for (const weather of (data.weather_suitability as string[] ?? [])) {
    run("INSERT INTO Attributes (garment_id, key, value, confidence, status) VALUES (?, 'weather', ?, 1, 'known')", [garmentId, weather]);
  }

  for (const [key, value, confidence, status] of attrFields) {
    if (value) {
      run(
        "INSERT INTO Attributes (garment_id, key, value, confidence, status) VALUES (?, ?, ?, ?, ?)",
        [garmentId, key, value, confidence, status]
      );
    }
  }

  // Save DNA
  const dna: Partial<DNAVector> = {
    Authority: data.dna_authority as number,
    Luxury: data.dna_luxury as number,
    Minimalism: data.dna_minimalism as number,
    Warmth: data.dna_warmth as number,
    Confidence: data.dna_confidence as number,
    Creativity: data.dna_creativity as number,
    Professionalism: data.dna_professionalism as number,
    VisualWeight: data.dna_visual_weight as number,
    Contrast: data.dna_contrast as number,
    Texture: data.dna_texture as number,
    Formality: data.dna_formality as number,
    Traditional: data.dna_traditional as number,
    Modern: data.dna_modern as number,
    Experimental: data.dna_experimental as number,
    Approachability: data.dna_approachability as number,
    Photogenic: data.dna_photogenic as number,
    Complexity: data.dna_complexity as number,
  };
  setGarmentDNA(garmentId, dna);

  // Queue low-confidence fields for review
  let reviewQueueCount = 0;
  const checkFields = [
    { field: "material", value: (data.material as any)?.value, confidence: (data.material as any)?.confidence ?? 1 },
    { field: "brand", value: (data.brand as any)?.value, confidence: (data.brand as any)?.confidence ?? 1 },
    { field: "fit", value: (data.fit as any)?.value, confidence: (data.fit as any)?.confidence ?? 1 },
    { field: "primary_color_hex", value: primary?.hex, confidence: primary?.confidence ?? 1 },
  ];

  for (const { field, value, confidence } of checkFields) {
    if (confidence < CONFIDENCE_REVIEW_THRESHOLD && value) {
      run(
        "INSERT INTO ReviewQueue (garment_id, field, ai_value, confidence) VALUES (?, ?, ?, ?)",
        [garmentId, field, String(value), confidence]
      );
      reviewQueueCount++;
    }
  }

  saveDb();
  log("success", "garment", `Garment analyzed and saved: ${garmentId} — ${data.item_name}`, { confidence: data.ai_confidence_overall });

  return {
    garmentId,
    metadata: { ...data, id: garmentId },
    reviewQueueCount,
    confidence: data.ai_confidence_overall as number,
  };
}
