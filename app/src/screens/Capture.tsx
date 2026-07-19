import { useState } from "react";
import { Btn, Field, ScreenHeader, TextArea } from "@/components/ui-bits";
import { useStore } from "@/lib/store";
import type { Garment } from "@/lib/types";
import { primaryColor, attributeValue, DNA_DIMENSIONS } from "@/lib/types";

// ─── Capture Screen ────────────────────────────────────────────────────────────

export function CaptureScreen() {
  const { analyzeItem, verifyItem, back, loading } = useStore();
  const [mode, setMode] = useState<"add" | "verify">("add");
  const [image, setImage] = useState("");
  const [context, setContext] = useState("");
  const [error, setError] = useState("");
  const [verdictData, setVerdictData] = useState<any>(null);

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
    setVerdictData(null);
    try {
      if (mode === "add") {
        await analyzeItem(image, context);
      } else {
        const res = await verifyItem(image, context);
        setVerdictData(res);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
    }
  };

  if (verdictData) {
    const v = verdictData;
    const isApprove = v.verdict === "approve";
    const isReject = v.verdict === "reject";
    const attrs = v.extracted_attributes;
    
    return (
      <div className="screen-pad space-y-6 mx-auto max-w-2xl w-full">
        <ScreenHeader title="Verdict" onBack={() => { setVerdictData(null); setImage(""); }} />
        
        <div className={`p-6 rounded-2xl text-center space-y-2 border ${
          isApprove ? "bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400" :
          isReject ? "bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400" :
          "bg-yellow-500/10 border-yellow-500/20 text-yellow-700 dark:text-yellow-400"
        }`}>
          <h2 className="text-3xl tracking-tight uppercase font-medium">
            {isApprove ? "BUY IT" : isReject ? "SKIP IT" : "MAYBE"}
          </h2>
          <p className="text-sm opacity-80">ROI Score: {v.roi_score}/100</p>
        </div>
        
        <div className="space-y-3">
          <h3 className="mono-label">Reasoning</h3>
          <ul className="space-y-2">
            {v.reasoning.map((r: string, i: number) => (
              <li key={i} className="flex gap-2 text-sm items-start">
                <span className="text-muted-foreground mt-0.5">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
        
        <div className="surface p-4 space-y-3">
          <h3 className="mono-label">Extracted Details</h3>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <div className="text-muted-foreground">Item Name</div>
            <div className="text-right truncate">{attrs.item_name}</div>
            <div className="text-muted-foreground">Category</div>
            <div className="text-right capitalize">{attrs.category}</div>
            {attrs.material?.value && (
              <>
                <div className="text-muted-foreground">Material</div>
                <div className="text-right capitalize">{attrs.material.value}</div>
              </>
            )}
            {attrs.brand?.value && (
              <>
                <div className="text-muted-foreground">Brand</div>
                <div className="text-right capitalize">{attrs.brand.value}</div>
              </>
            )}
          </div>
        </div>

        <div className="space-y-3 pt-4 flex flex-col items-center w-full">
          <Btn onClick={() => { setVerdictData(null); setImage(""); }}>Done</Btn>
          <button 
            className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={async () => {
              setVerdictData(null);
              setMode("add");
              await analyzeItem(image, context);
            }}
          >
            Add to Wardrobe Anyway
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen-pad space-y-4 mx-auto max-w-2xl w-full">
      <ScreenHeader title="Scan Cloth" subtitle="AI Vision Analysis" onBack={back} />

      <div className="flex gap-2 rounded-full border border-border p-1 text-sm bg-background/50 backdrop-blur-sm mx-auto w-fit mb-4">
        <button
          className={`rounded-full px-4 py-1.5 transition-colors ${mode === "add" ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => { setMode("add"); setVerdictData(null); }}
        >
          Add to Wardrobe
        </button>
        <button
          className={`rounded-full px-4 py-1.5 transition-colors ${mode === "verify" ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => { setMode("verify"); setVerdictData(null); }}
        >
          Should I Buy This?
        </button>
      </div>

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
            <div className="flex justify-center w-full">
              <label className="tap flex cursor-pointer flex-col items-center justify-center rounded-xl bg-secondary w-full p-8 transition-colors hover:bg-accent border border-dashed border-border/50">
                <input
                  hidden
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={isAnalyzing}
                  onChange={(e) => onFile(e.target.files?.[0])}
                />
                <span className="mono-label text-base tracking-widest uppercase">Upload Photo</span>
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
        ) : mode === "add" ? "Analyze & Save" : "Check If I Should Buy"}
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
