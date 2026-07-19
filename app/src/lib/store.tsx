/**
 * AYA OS v1.0 — Store (State Management)
 * All data now comes from the SQLite API. localStorage only for UI prefs.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type {
  Screen, Garment, AnalysisResult, OutfitRecommendation,
  DecisionContext, SystemStatus, ActivityEntry,
  GalleryImage, Collection
} from "./types";

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error ?? `Request failed: ${path}`);
  }
  return res.json();
}

// ─── Context interface ────────────────────────────────────────────────────────

interface StoreCtx {
  // Navigation
  screen: Screen;
  navigate: (s: Screen) => void;
  back: () => void;

  // Garments
  garments: Garment[];
  refreshWardrobe: () => Promise<void>;
  analyzeItem: (imageDataUrl: string, userContext: string) => Promise<AnalysisResult>;
  verifyItem: (imageDataUrl: string, userContext: string) => Promise<any>;
  updateGarment: (id: string, patch: Partial<Garment>) => Promise<void>;
  archiveGarment: (id: string) => Promise<void>;
  deleteGarment: (id: string) => Promise<void>;

  // Capture draft (in-memory until saved to DB)
  draft: AnalysisResult | null;
  setDraft: (d: AnalysisResult | null) => void;

  // Outfit generation
  lastOutfit: OutfitRecommendation | null;
  generateOutfit: (ctx: DecisionContext) => Promise<OutfitRecommendation>;

  // Gallery
  galleryImages: GalleryImage[];
  refreshGallery: () => Promise<void>;
  collections: Collection[];
  refreshCollections: () => Promise<void>;

  // System
  status: SystemStatus | null;
  refreshStatus: () => Promise<void>;
  activity: ActivityEntry[];
  refreshActivity: () => Promise<void>;
  runCompiler: () => Promise<{ rules: number; research: number; flowEntries: number }>;
  runBackup: () => Promise<{ path: string; filename: string }>;

  // UI settings (localStorage)
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
  fontSize: "compact" | "comfort" | "large";
  setFontSize: (v: "compact" | "comfort" | "large") => void;

  // Loading states
  loading: Record<string, boolean>;
}

const Ctx = createContext<StoreCtx | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStack] = useState<Screen[]>([{ name: "home" }]);
  const [garments, setGarments] = useState<Garment[]>([]);
  const [draft, setDraft] = useState<AnalysisResult | null>(null);
  const [lastOutfit, setLastOutfit] = useState<OutfitRecommendation | null>(null);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  // UI prefs from localStorage
  const [darkMode, setDarkModeState] = useState(() => localStorage.getItem("aya.darkMode") === "true");
  const [fontSize, setFontSizeState] = useState<"compact" | "comfort" | "large">(
    () => (localStorage.getItem("aya.fontSize") as any) ?? "comfort"
  );

  // Apply theme
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    document.documentElement.setAttribute("data-fs", fontSize);
  }, [darkMode, fontSize]);

  const setDarkMode = useCallback((v: boolean) => {
    setDarkModeState(v);
    localStorage.setItem("aya.darkMode", String(v));
  }, []);

  const setFontSize = useCallback((v: "compact" | "comfort" | "large") => {
    setFontSizeState(v);
    localStorage.setItem("aya.fontSize", v);
  }, []);

  // ─── Loading helper ─────────────────────────────────────────────────────────

  const withLoading = useCallback(async (key: string, fn: () => Promise<any>): Promise<any> => {
    setLoading((l) => ({ ...l, [key]: true }));
    try { return await fn(); }
    finally { setLoading((l) => ({ ...l, [key]: false })); }
  }, []);

  // ─── Navigation ─────────────────────────────────────────────────────────────

  const navigate = useCallback((s: Screen) => setStack((p) => [...p, s]), []);
  const back = useCallback(() => setStack((p) => p.length > 1 ? p.slice(0, -1) : p), []);

  // ─── Wardrobe ───────────────────────────────────────────────────────────────

  const refreshWardrobe = useCallback(async () => {
    const data = await apiFetch<Garment[]>("/api/wardrobe");
    setGarments(data);
  }, []);

  useEffect(() => { refreshWardrobe(); }, [refreshWardrobe]);

  const analyzeItem = useCallback(async (imageDataUrl: string, userContext: string): Promise<AnalysisResult> => {
    return withLoading("analyze", async () => {
      const result = await apiFetch<AnalysisResult>("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageDataUrl, context: userContext }),
      });
      setDraft(result);
      navigate({ name: "review" });
      return result;
    });
  }, [withLoading, navigate]);

  const verifyItem = useCallback(async (imageDataUrl: string, userContext: string): Promise<any> => {
    return withLoading("analyze", async () => {
      const result = await apiFetch<any>("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageDataUrl, context: userContext }),
      });
      return result;
    });
  }, [withLoading]);

  const updateGarment = useCallback(async (id: string, patch: Partial<Garment>) => {
    await apiFetch(`/api/wardrobe/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await refreshWardrobe();
  }, [refreshWardrobe]);

  const archiveGarment = useCallback(async (id: string) => {
    await apiFetch(`/api/wardrobe/${id}/archive`, { method: "POST" });
    await refreshWardrobe();
  }, [refreshWardrobe]);

  const deleteGarment = useCallback(async (id: string) => {
    await apiFetch(`/api/wardrobe/${id}`, { method: "DELETE" });
    await refreshWardrobe();
  }, [refreshWardrobe]);

  // ─── Outfit ─────────────────────────────────────────────────────────────────

  const generateOutfit = useCallback(async (ctx: DecisionContext): Promise<OutfitRecommendation> => {
    return withLoading("outfit", async () => {
      const result = await apiFetch<OutfitRecommendation>("/api/outfit/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ctx),
      });
      setLastOutfit(result);
      return result;
    });
  }, [withLoading]);

  // ─── Gallery ────────────────────────────────────────────────────────────────

  const refreshGallery = useCallback(async () => {
    const data = await apiFetch<GalleryImage[]>("/api/gallery");
    setGalleryImages(data);
  }, []);

  const refreshCollections = useCallback(async () => {
    const data = await apiFetch<Collection[]>("/api/collections");
    setCollections(data);
  }, []);

  useEffect(() => { 
    refreshGallery();
    refreshCollections();
  }, [refreshGallery, refreshCollections]);

  // ─── System ─────────────────────────────────────────────────────────────────

  const refreshStatus = useCallback(async () => {
    const data = await apiFetch<SystemStatus>("/api/status");
    setStatus(data);
  }, []);

  const refreshActivity = useCallback(async () => {
    const data = await apiFetch<ActivityEntry[]>("/api/activity?limit=50");
    setActivity(data);
  }, []);

  const runCompiler = useCallback(async () => {
    return withLoading("compiler", () =>
      apiFetch<{ rules: number; research: number; flowEntries: number }>("/api/compile", { method: "POST" })
    );
  }, [withLoading]);

  const runBackup = useCallback(async () => {
    return withLoading("backup", () =>
      apiFetch<{ path: string; filename: string }>("/api/backup", { method: "POST" })
    );
  }, [withLoading]);

  // Initial status load
  useEffect(() => { refreshStatus(); }, [refreshStatus]);

  const api = useMemo<StoreCtx>(() => ({
    screen: stack[stack.length - 1],
    navigate, back,
    garments, refreshWardrobe,
    analyzeItem, updateGarment, archiveGarment, deleteGarment,
    draft, setDraft,
    lastOutfit, generateOutfit,
    galleryImages, refreshGallery,
    collections, refreshCollections,
    status, refreshStatus,
    activity, refreshActivity,
    runCompiler, runBackup,
    darkMode, setDarkMode, fontSize, setFontSize,
    loading,
  }), [
    stack, navigate, back,
    garments, refreshWardrobe,
    analyzeItem, updateGarment, archiveGarment, deleteGarment,
    draft, setDraft,
    lastOutfit, generateOutfit,
    galleryImages, refreshGallery,
    collections, refreshCollections,
    status, refreshStatus,
    activity, refreshActivity,
    runCompiler, runBackup,
    darkMode, setDarkMode, fontSize, setFontSize,
    loading,
  ]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStore must be used inside StoreProvider");
  return c;
}
