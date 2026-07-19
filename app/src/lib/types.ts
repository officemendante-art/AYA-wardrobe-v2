// AYA OS v1.0 — TypeScript Types
// Single source of truth for all frontend data structures.

// ─── DNA ──────────────────────────────────────────────────────────────────────

export const DNA_DIMENSIONS = [
  "Authority", "Luxury", "Minimalism", "Warmth", "Confidence", "Creativity",
  "Professionalism", "VisualWeight", "Contrast", "Texture", "Formality",
  "Traditional", "Modern", "Experimental", "Approachability", "Photogenic", "Complexity",
] as const;

export type DNADimension = typeof DNA_DIMENSIONS[number];
export type DNAVector = Record<DNADimension, number>;

// ─── Garments ─────────────────────────────────────────────────────────────────

export type Category =
  | "tops" | "bottoms" | "outerwear" | "shoes" | "watches"
  | "eyewear" | "jewelry" | "bags" | "belts" | "accessories" | "unknown";

export type ColorRole = "primary" | "secondary" | "accent" | "stripe" | "trim" | "logo" | "pattern";

export interface GarmentColor {
  id?: number;
  garment_id?: string;
  role: ColorRole;
  name: string;
  hex: string;
  confidence: number;
}

export interface GarmentAttribute {
  key: string;
  value: string;
  confidence: number;
  status?: "known" | "likely" | "unknown";
}

export interface DNAEntry {
  dimension: string;
  score: number;
}

export interface Garment {
  id: string;
  item_name: string;
  category: Category;
  type?: string;
  image_path?: string;
  archived: number;
  deleted: number;
  collar_type?: string;
  sleeve_type?: string;
  buttons?: string;
  texture?: string;
  visual_weight?: string;
  layering_suitability?: string;
  luxury_score?: number;
  minimalism_score?: number;
  photogenic_score?: number;
  ai_confidence_overall?: number;
  condition?: string;
  purchase_price?: number;
  brand?: string;
  created_at: string;
  modified_at: string;
  // Enriched
  colors: GarmentColor[];
  attributes: GarmentAttribute[];
  dna: DNAEntry[];
}

// Derived helpers
export function primaryColor(garment: Garment): GarmentColor | null {
  return garment.colors.find((c) => c.role === "primary") ?? garment.colors[0] ?? null;
}

export function attributeValue(garment: Garment, key: string): string | null {
  return garment.attributes.find((a) => a.key === key)?.value ?? null;
}

export function garmentDNA(garment: Garment): Partial<DNAVector> {
  return Object.fromEntries(garment.dna.map((d) => [d.dimension, d.score])) as Partial<DNAVector>;
}

// ─── Analysis Result ──────────────────────────────────────────────────────────

export interface AnalysisResult {
  garmentId: string;
  metadata: Garment;
  reviewQueueCount: number;
  confidence: number;
}

// ─── Outfits ──────────────────────────────────────────────────────────────────

export interface OutfitItem {
  id: string;
  item_name: string;
  category: Category;
  role: string;
  primary_color: string;
  image_path: string | null;
}

export interface OutfitRecommendation {
  outfit_id: string;
  garments: OutfitItem[];
  dna: Partial<DNAVector>;
  similarity_score: number;
  similarity_approved: boolean;
  exploration: {
    active: boolean;
    description?: string;
    experiment_id?: number;
  };
  reasoning: string;
  image_prompt: string;
  alternative_suggestion: string;
}

export interface DecisionContext {
  occasion: string;
  weather?: string;
  temperature_c?: number;
  mood?: string;
  dress_code?: string;
  photography?: boolean;
  laundry_constraints?: string[];
  avoid_garments?: string[];
}

// ─── Gallery ──────────────────────────────────────────────────────────────────

export interface GalleryImage {
  id: string;
  title: string;
  image_path: string;
  occasion?: string;
  season?: string;
  style?: string;
  primary_colors?: string;
  secondary_colors?: string;
  fabric?: string;
  fit?: string;
  notes?: string;
  dna?: string;
  similarity_score?: number;
  is_favorite: number;
  source: string;
  prompt?: string;
  created_at: string;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

// ─── Activity Log ─────────────────────────────────────────────────────────────

export interface ActivityEntry {
  id: number;
  level: "info" | "warning" | "error" | "success";
  category: string;
  message: string;
  details?: string;
  entity_id?: string;
  timestamp: string;
}

// ─── System Status ────────────────────────────────────────────────────────────

export interface SystemStatus {
  status: "healthy" | "error";
  counts: {
    garments: number;
    colors: number;
    outfits: number;
    rules: number;
    research: number;
    gallery: number;
    fabrics: number;
  };
  schema?: Record<string, unknown>;
  timestamp: string;
}

// ─── App Settings ─────────────────────────────────────────────────────────────

export interface AppSettings {
  dark_mode: string;
  font_size: string;
  wardrobe_name: string;
  owner_name: string;
  api_validated: string;
}

// ─── Screen Navigation ────────────────────────────────────────────────────────

export type Screen =
  | { name: "home" }
  | { name: "capture" }
  | { name: "gallery" }
  | { name: "details"; id: string }
  | { name: "outfit" }
  | { name: "activity" }
  | { name: "settings" };

// ─── Legacy (kept for compatibility) ─────────────────────────────────────────

export const CATEGORIES: Category[] = [
  "tops", "bottoms", "outerwear", "shoes", "watches",
  "eyewear", "jewelry", "bags", "belts", "accessories", "unknown",
];

export const CATEGORY_PREFIX: Record<Category, string> = {
  tops: "TOP", bottoms: "BOTTOM", outerwear: "OUTER", shoes: "FOOT",
  watches: "WATCH", eyewear: "EYE", jewelry: "JEWEL", bags: "BAG",
  belts: "BELT", accessories: "ACC", unknown: "ACC",
};
