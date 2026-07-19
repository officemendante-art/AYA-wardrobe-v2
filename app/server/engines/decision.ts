/**
 * AYA OS v1.0 — Decision Engine
 * The main orchestrator. Routes through all intelligence layers to produce
 * a single outfit recommendation per request.
 *
 * Flow:
 * Identity → Body Rules → Color Engine → Fabric → Style → Occasion
 *   → Similarity Check → Exploration (10%) → Final Outfit
 */

import { GoogleGenAI } from "@google/genai";
import { queryAll, run, saveDb, log } from "../db.js";
import { buildIdentityContext } from "./identity.js";
import { computeOutfitDNA, storeOutfitDNA, dnaToString } from "./dna.js";
import { checkSimilarityToRecent } from "./similarity.js";
import { shouldExplore, pickExploration } from "./exploration.js";

export interface DecisionContext {
  occasion: string;           // casual | smart_casual | formal | business | festive | travel | wedding
  weather?: string;           // sunny | cloudy | rainy | humid | cold | hot
  temperature_c?: number;
  mood?: string;
  dress_code?: string;
  photography?: boolean;
  laundry_constraints?: string[]; // garment IDs currently in laundry
  avoid_garments?: string[];      // IDs to exclude
}

export interface OutfitRecommendation {
  outfit_id: string;
  garments: Array<{
    id: string;
    item_name: string;
    category: string;
    role: string;
    primary_color: string;
    image_path: string | null;
  }>;
  dna: Record<string, number>;
  similarity_score: number;
  similarity_approved: boolean;
  exploration: { active: boolean; description?: string; experiment_id?: number };
  reasoning: string;
  image_prompt: string;
  alternative_suggestion: string;
  context: DecisionContext;
}

// ─── Main orchestration ────────────────────────────────────────────────────────

export async function generateOutfit(
  context: DecisionContext,
  apiKey: string
): Promise<OutfitRecommendation> {
  // 1. Build identity context from DB
  const identityContext = buildIdentityContext();

  // 2. Get available garments from DB
  const excludeIds = [
    ...(context.laundry_constraints ?? []),
    ...(context.avoid_garments ?? []),
  ];

  const availableGarments = queryAll<{
    id: string;
    item_name: string;
    category: string;
    image_path: string | null;
  }>(
    `SELECT g.id, g.item_name, g.category, g.image_path
     FROM Garments g
     WHERE g.archived = 0 AND g.deleted = 0
     ${excludeIds.length ? `AND g.id NOT IN (${excludeIds.map(() => "?").join(",")})` : ""}`,
    excludeIds
  );

  // 3. Get colors and attributes for context
  const garmentDetails = availableGarments.map((g) => {
    const colors = queryAll<{ name: string; hex: string; role: string }>(
      "SELECT name, hex, role FROM Colors WHERE garment_id = ? ORDER BY role ASC",
      [g.id]
    );
    const attrs = queryAll<{ key: string; value: string }>(
      "SELECT key, value FROM Attributes WHERE garment_id = ?",
      [g.id]
    );
    const attrMap = Object.fromEntries(attrs.map((a) => [a.key, a.value]));
    const primaryColor = colors.find((c) => c.role === "primary") ?? colors[0];
    return {
      ...g,
      primary_color: primaryColor?.name ?? "unknown",
      primary_hex: primaryColor?.hex ?? "#000000",
      material: attrMap["material"] ?? "unknown",
      formality: attrMap["formality"] ?? "casual",
      season: attrMap["season"] ?? "all",
      fit: attrMap["fit"] ?? "regular",
    };
  });

  // 4. Check exploration injection
  const exploreThis = shouldExplore();
  const explorationItem = exploreThis ? pickExploration() : null;

  // 5. Call Gemini as reasoning tool
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `${identityContext}

=== AVAILABLE WARDROBE ===
${garmentDetails.map((g) =>
    `[${g.id}] ${g.item_name} | ${g.category} | Color: ${g.primary_color} (${g.primary_hex}) | Material: ${g.material} | Fit: ${g.fit} | Formality: ${g.formality} | Season: ${g.season}`
  ).join("\n")}

=== TODAY'S CONTEXT ===
Occasion: ${context.occasion}
Weather: ${context.weather ?? "not specified"}
Temperature: ${context.temperature_c ? `${context.temperature_c}°C` : "not specified"}
Mood: ${context.mood ?? "neutral"}
Photography: ${context.photography ? "Yes – prioritize photogenic choices" : "No"}
${context.dress_code ? `Dress Code: ${context.dress_code}` : ""}
${explorationItem ? `\n=== EXPLORATION EXPERIMENT ===\nTry to incorporate this if possible: ${explorationItem.description}` : ""}

=== YOUR TASK ===
Select the best outfit from the available wardrobe. Follow all identity and body rules above.
Return valid JSON with this exact structure:
{
  "selected_garment_ids": ["TOP-001", "BOTTOM-002", ...],
  "roles": {"TOP-001": "top", "BOTTOM-002": "bottom"},
  "reasoning": "Brief explanation of your selection choices",
  "image_prompt": "Detailed image generation prompt for this outfit",
  "alternative_suggestion": "A brief alternative outfit idea using different pieces"
}`;

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: [{ text: prompt }],
    config: { responseMimeType: "application/json" },
  });

  let aiResult: {
    selected_garment_ids: string[];
    roles: Record<string, string>;
    reasoning: string;
    image_prompt: string;
    alternative_suggestion: string;
  };

  try {
    aiResult = JSON.parse(response.text?.trim() ?? "{}");
  } catch {
    throw new Error("Gemini returned malformed JSON. Please retry.");
  }

  // Validate garment IDs exist
  const validIds = new Set(availableGarments.map((g) => g.id));
  const selectedIds = (aiResult.selected_garment_ids ?? []).filter((id) => validIds.has(id));

  if (!selectedIds.length) throw new Error("No valid garments selected by AI.");

  // 6. Compute outfit DNA
  const dna = computeOutfitDNA(selectedIds);

  // 7. Similarity check
  const similarity = checkSimilarityToRecent(dna);

  // 8. Store outfit in DB
  const outfitId = `OUTFIT-${Date.now()}`;
  run(
    `INSERT INTO Outfits
     (id, occasion, weather, mood, temperature_c, similarity_score, diversity_approved, ai_reasoning, image_prompt, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      outfitId,
      context.occasion,
      context.weather ?? null,
      context.mood ?? null,
      context.temperature_c ?? null,
      similarity.score,
      similarity.approved ? 1 : 0,
      aiResult.reasoning,
      aiResult.image_prompt,
    ]
  );

  for (const garmentId of selectedIds) {
    const role = aiResult.roles?.[garmentId] ?? "item";
    run(
      "INSERT INTO OutfitItems (outfit_id, garment_id, role) VALUES (?, ?, ?)",
      [outfitId, garmentId, role]
    );
  }

  storeOutfitDNA(outfitId, dna);
  saveDb();

  log("success", "outfit", `Outfit generated: ${outfitId}`, {
    occasion: context.occasion,
    garments: selectedIds,
    similarity: similarity.score,
  });

  // 9. Build response
  const selectedGarments = garmentDetails.filter((g) => selectedIds.includes(g.id));

  return {
    outfit_id: outfitId,
    garments: selectedGarments.map((g) => ({
      id: g.id,
      item_name: g.item_name,
      category: g.category,
      role: aiResult.roles?.[g.id] ?? "item",
      primary_color: g.primary_color,
      image_path: g.image_path,
    })),
    dna,
    similarity_score: similarity.score,
    similarity_approved: similarity.approved,
    exploration: {
      active: !!explorationItem,
      description: explorationItem?.description,
      experiment_id: explorationItem?.id,
    },
    reasoning: aiResult.reasoning,
    image_prompt: aiResult.image_prompt,
    alternative_suggestion: aiResult.alternative_suggestion,
    context,
  };
}
