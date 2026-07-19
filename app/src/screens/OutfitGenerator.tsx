import { useState } from "react";
import { Btn, Chip, Field, ScreenHeader } from "@/components/ui-bits";
import { useStore } from "@/lib/store";
import type { DecisionContext, OutfitRecommendation } from "@/lib/types";
import { DNA_DIMENSIONS } from "@/lib/types";

const OCCASIONS = ["casual", "smart_casual", "formal", "business", "festive", "travel", "wedding", "beach"];
const WEATHERS = ["sunny", "cloudy", "rainy", "humid", "hot", "cold"];
const MOODS = ["confident", "minimal", "relaxed", "sharp", "creative", "quiet"];

export function OutfitGeneratorScreen() {
  const { generateOutfit, loading, garments } = useStore();

  const [occasion, setOccasion] = useState("casual");
  const [weather, setWeather] = useState("sunny");
  const [mood, setMood] = useState("confident");
  const [photography, setPhotography] = useState(false);
  const [temperature, setTemperature] = useState("");
  const [result, setResult] = useState<OutfitRecommendation | null>(null);
  const [error, setError] = useState("");

  const isGenerating = loading["outfit"];
  const activeGarments = garments.filter((g) => !g.deleted && !g.archived);

  const handleGenerate = async () => {
    if (activeGarments.length < 2) {
      setError("Add at least 2 garments to your wardrobe first.");
      return;
    }
    setError("");
    const ctx: DecisionContext = {
      occasion,
      weather,
      mood,
      photography,
      temperature_c: temperature ? Number(temperature) : undefined,
    };
    try {
      const res = await generateOutfit(ctx);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.");
    }
  };

  const logInteraction = async (action: "worn" | "rejected" | "saved") => {
    if (!result) return;
    try {
      await fetch("/api/interaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_type: "outfit",
          entity_id: result.outfit_id,
          action,
          context: { occasion, weather, mood },
        }),
      });
      if (action !== "worn") setResult(null);
    } catch (_) {}
  };

  return (
    <div className="screen-pad space-y-5">
      <ScreenHeader title="Outfit Generator" subtitle="Decision Engine" />

      {/* Context selectors */}
      <Field label="Occasion">
        <div className="flex flex-wrap gap-2">
          {OCCASIONS.map((o) => (
            <Chip key={o} active={occasion === o} onClick={() => setOccasion(o)}>{o.replace("_", " ")}</Chip>
          ))}
        </div>
      </Field>

      <Field label="Weather">
        <div className="flex flex-wrap gap-2">
          {WEATHERS.map((w) => (
            <Chip key={w} active={weather === w} onClick={() => setWeather(w)}>{w}</Chip>
          ))}
        </div>
      </Field>

      <Field label="Mood">
        <div className="flex flex-wrap gap-2">
          {MOODS.map((m) => (
            <Chip key={m} active={mood === m} onClick={() => setMood(m)}>{m}</Chip>
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Temperature °C">
          <input
            type="number"
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
            placeholder="e.g. 28"
            className="w-full rounded-xl border border-border bg-card px-3 py-3 text-sm outline-none"
          />
        </Field>
        <Field label="Photography">
          <button
            onClick={() => setPhotography((v) => !v)}
            className={`tap w-full rounded-xl border px-3 text-sm ${photography ? "border-foreground bg-foreground text-background" : "border-border bg-card"}`}
          >
            {photography ? "Yes" : "No"}
          </button>
        </Field>
      </div>

      {error && <div className="surface border-red-500/40 bg-red-500/5 p-3 text-xs text-red-400">{error}</div>}

      <Btn onClick={handleGenerate} disabled={isGenerating}>
        {isGenerating ? (
          <div className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
            Generating outfit...
          </div>
        ) : "Generate Outfit"}
      </Btn>

      {/* Result */}
      {result && (
        <div className="space-y-4 border-t border-border pt-4">
          {/* Garments */}
          <div>
            <div className="mono-label mb-2">Selected Garments</div>
            <div className="surface divide-hair overflow-hidden">
              {result.garments.map((g) => (
                <div key={g.id} className="flex items-center gap-3 p-3">
                  {g.image_path ? (
                    <img src={`/${g.image_path}`} alt="" className="h-12 w-12 rounded-lg object-cover bg-secondary" />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-secondary" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{g.item_name}</div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{g.role} · {g.primary_color}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Similarity */}
          <div className="surface p-3">
            <div className="flex items-center justify-between">
              <div className="mono-label">Similarity to recent</div>
              <div className={`text-sm font-semibold ${result.similarity_score > 70 ? "text-red-400" : result.similarity_score > 50 ? "text-amber-400" : ""}`}>
                {result.similarity_score}%
              </div>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className={`h-full rounded-full ${result.similarity_score > 70 ? "bg-red-400" : result.similarity_score > 50 ? "bg-amber-400" : "bg-foreground"}`}
                style={{ width: `${result.similarity_score}%` }}
              />
            </div>
            {!result.similarity_approved && (
              <div className="mt-1 text-[10px] text-red-400">⚠ Too similar to recent outfits</div>
            )}
          </div>

          {/* DNA top dims */}
          {Object.keys(result.dna).length > 0 && (
            <div className="surface p-3">
              <div className="mono-label mb-2">Outfit DNA</div>
              {DNA_DIMENSIONS.slice(0, 6).map((dim) => {
                const score = result.dna[dim] ?? 50;
                return (
                  <div key={dim} className="mb-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span>{dim}</span>
                      <span className="text-muted-foreground">{Math.round(score)}</span>
                    </div>
                    <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-foreground" style={{ width: `${score}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Exploration */}
          {result.exploration.active && (
            <div className="surface border-amber-400/50 p-3">
              <div className="mono-label text-amber-400">Exploration Active (10%)</div>
              <div className="mt-1 text-xs">{result.exploration.description}</div>
            </div>
          )}

          {/* Reasoning */}
          <div className="surface p-3">
            <div className="mono-label mb-1">AI Reasoning</div>
            <p className="text-xs leading-relaxed text-muted-foreground">{result.reasoning}</p>
          </div>

          {/* Alternative */}
          {result.alternative_suggestion && (
            <div className="surface p-3">
              <div className="mono-label mb-1">Alternative</div>
              <p className="text-xs leading-relaxed text-muted-foreground">{result.alternative_suggestion}</p>
            </div>
          )}

          {/* Actions */}
          <div className="grid grid-cols-3 gap-2">
            <Btn variant="primary" onClick={() => logInteraction("worn")}>Wore It</Btn>
            <Btn variant="secondary" onClick={() => logInteraction("saved")}>Save</Btn>
            <Btn variant="secondary" onClick={() => logInteraction("rejected")}>Skip</Btn>
          </div>
          <Btn variant="ghost" onClick={handleGenerate} disabled={isGenerating}>Regenerate</Btn>
        </div>
      )}
    </div>
  );
}
