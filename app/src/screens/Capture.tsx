import { useState } from "react";
import { Btn, Field, ScreenHeader, TextArea } from "@/components/ui-bits";
import { useStore } from "@/lib/store";
import type { Garment } from "@/lib/types";
import { primaryColor, attributeValue, DNA_DIMENSIONS } from "@/lib/types";

// ─── Capture Screen ────────────────────────────────────────────────────────────

export function CaptureScreen() {
  const { analyzeItem, back, loading } = useStore();
  const [image, setImage] = useState("");
  const [context, setContext] = useState("");
  const [error, setError] = useState("");

  const isAnalyzing = loading["analyze"];

  const onFile = (file?: File) => {
    setError("");
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Use JPG, PNG, or WEBP.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  };

  const analyze = async () => {
    if (isAnalyzing || !image) return;
    setError("");
    try {
      await analyzeItem(image, context);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
    }
  };

  return (
    <div className="screen-pad space-y-4">
      <ScreenHeader title="Scan Cloth" subtitle="AI Vision Analysis" onBack={back} />

      <div className="surface flex min-h-[300px] items-center justify-center overflow-hidden text-center">
        {image ? (
          <label className="cursor-pointer w-full">
            <input
              hidden
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={isAnalyzing}
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <img src={image} alt="Cloth" className="max-h-[400px] w-full object-contain" />
          </label>
        ) : (
          <div className="space-y-6 w-full p-6">
            <div className="text-4xl text-muted-foreground">□</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="tap flex cursor-pointer flex-col items-center justify-center rounded-xl bg-secondary p-4 transition-colors hover:bg-accent">
                <input
                  hidden
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  disabled={isAnalyzing}
                  onChange={(e) => onFile(e.target.files?.[0])}
                />
                <span className="mono-label">Take Photo</span>
              </label>
              <label className="tap flex cursor-pointer flex-col items-center justify-center rounded-xl bg-secondary p-4 transition-colors hover:bg-accent">
                <input
                  hidden
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={isAnalyzing}
                  onChange={(e) => onFile(e.target.files?.[0])}
                />
                <span className="mono-label">Upload Photo</span>
              </label>
            </div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">JPG · PNG · WEBP</p>
          </div>
        )}
      </div>

      <Field label="Optional Context" hint="Describe anything the AI might miss — actual color, focus area, etc.">
        <TextArea
          rows={3}
          value={context}
          disabled={isAnalyzing}
          onChange={(e) => setContext(e.target.value)}
          placeholder="e.g. The shirt is forest olive, not dark green. Focus on the shirt, ignore the background."
        />
      </Field>

      {error && <div className="surface border-red-500/40 bg-red-500/5 p-3 text-xs text-red-400">{error}</div>}

      <Btn onClick={analyze} disabled={!image || isAnalyzing}>
        {isAnalyzing ? (
          <div className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
            Analyzing with Gemini Vision...
          </div>
        ) : "Analyze Cloth"}
      </Btn>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Extracts 25+ attributes including fabric, fit, color (with HEX), DNA dimensions, and confidence scores.
        Low-confidence fields are queued for your review.
      </p>
    </div>
  );
}

// ─── Review Screen ─────────────────────────────────────────────────────────────

export function ReviewScreen() {
  const { draft, setDraft, refreshWardrobe, navigate, back } = useStore();
  const [saving, setSaving] = useState(false);

  if (!draft) {
    return (
      <div className="screen-pad">
        <ScreenHeader title="Review" onBack={back} />
        <div className="surface p-4 text-xs text-muted-foreground">No item waiting for review.</div>
      </div>
    );
  }

  const g = draft.metadata;
  const pc = primaryColor(g as Garment);
  const material = attributeValue(g as Garment, "material");
  const fit = attributeValue(g as Garment, "fit");
  const formality = attributeValue(g as Garment, "formality");

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await refreshWardrobe();
      setDraft(null);
      navigate({ name: "library" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="screen-pad space-y-4">
      <ScreenHeader
        title="Review Result"
        subtitle={`Confidence: ${Math.round((draft.confidence ?? 0) * 100)}%`}
        onBack={back}
      />

      {/* Image */}
      <div className="surface aspect-square overflow-hidden">
        <img src={g.image_path ? `/${g.image_path}` : ""} alt={g.item_name} className="h-full w-full object-contain" />
      </div>

      {/* ID + Name */}
      <div className="surface p-4 space-y-1">
        <div className="mono-label">{draft.garmentId}</div>
        <div className="font-semibold">{g.item_name}</div>
        <div className="text-xs text-muted-foreground">{g.category} · {g.type}</div>
      </div>

      {/* Primary color */}
      {pc && (
        <div className="surface flex items-center gap-3 p-4">
          <div
            className="h-10 w-10 shrink-0 rounded-lg border border-border"
            style={{ background: pc.hex }}
          />
          <div>
            <div className="text-sm font-semibold">{pc.name}</div>
            <div className="text-[11px] text-muted-foreground">{pc.hex} · {Math.round(pc.confidence * 100)}% confidence</div>
          </div>
        </div>
      )}

      {/* Key attributes */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Material", value: material },
          { label: "Fit", value: fit },
          { label: "Formality", value: formality },
          { label: "Luxury", value: g.luxury_score !== undefined ? `${Math.round(g.luxury_score as number)}/100` : null },
          { label: "Minimal", value: g.minimalism_score !== undefined ? `${Math.round(g.minimalism_score as number)}/100` : null },
          { label: "Photogenic", value: g.photogenic_score !== undefined ? `${Math.round(g.photogenic_score as number)}/100` : null },
        ].map(({ label, value }) => value ? (
          <div key={label} className="surface p-3">
            <div className="mono-label">{label}</div>
            <div className="mt-1 text-xs font-medium capitalize">{value}</div>
          </div>
        ) : null)}
      </div>

      {/* Review queue alert */}
      {draft.reviewQueueCount > 0 && (
        <div className="surface border-amber-400/60 p-3">
          <div className="mono-label text-amber-400">Review Required</div>
          <div className="mt-1 text-xs">
            {draft.reviewQueueCount} field{draft.reviewQueueCount > 1 ? "s" : ""} flagged for low confidence.
            You can review these in Library → Cloth Details.
          </div>
        </div>
      )}

      <Btn onClick={handleConfirm} disabled={saving}>
        {saving ? "Saving..." : "Confirm & Save to Database"}
      </Btn>
      <Btn variant="secondary" onClick={back}>Re-analyze</Btn>
    </div>
  );
}
