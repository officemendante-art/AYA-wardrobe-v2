import { useEffect, useState } from "react";
import { Btn, Field, ScreenHeader } from "@/components/ui-bits";
import { useStore } from "@/lib/store";
import type { ROIResult, ShoppingCandidate } from "@/lib/types";

const CATEGORIES = ["tops", "bottoms", "outerwear", "shoes", "accessories"];
const SEASONS = ["summer", "monsoon", "winter", "spring"];
const OCCASIONS = ["casual", "smart_casual", "formal", "business", "festive", "travel"];
const MAINTENANCE = ["low", "medium", "high"] as const;

export function ShoppingScreen() {
  const { shopping, refreshShopping } = useStore();
  const [tab, setTab] = useState<"candidates" | "roi">("candidates");
  const [roiResult, setRoiResult] = useState<ROIResult | null>(null);
  const [roiLoading, setRoiLoading] = useState(false);

  // ROI form
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState("tops");
  const [price, setPrice] = useState("");
  const [seasons, setSeasons] = useState<string[]>(["summer"]);
  const [occasions, setOccasions] = useState<string[]>(["casual"]);
  const [maintenance, setMaintenance] = useState<"low" | "medium" | "high">("low");

  useEffect(() => { refreshShopping(); }, [refreshShopping]);

  const handleROI = async () => {
    if (!itemName || !price) return;
    setRoiLoading(true);
    try {
      const res = await fetch("/api/shopping/roi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_name: itemName, category, price: Number(price), seasons, occasions, maintenance }),
      });
      setRoiResult(await res.json());
    } finally {
      setRoiLoading(false);
    }
  };

  const updateStatus = async (id: number, status: ShoppingCandidate["status"]) => {
    await fetch(`/api/shopping/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await refreshShopping();
  };

  const verdictColor: Record<string, string> = {
    approve: "text-green-400",
    consider: "text-amber-400",
    reject: "text-red-400",
  };

  return (
    <div className="screen-pad">
      <ScreenHeader title="Shopping" subtitle="ROI Intelligence" />

      {/* Tabs */}
      <div className="mb-4 flex gap-2">
        <button onClick={() => setTab("candidates")} className={`chip ${tab === "candidates" ? "chip[data-active=true]" : ""}`} data-active={tab === "candidates" ? "true" : "false"}>
          Candidates ({shopping.length})
        </button>
        <button onClick={() => setTab("roi")} className="chip" data-active={tab === "roi" ? "true" : "false"}>
          ROI Calculator
        </button>
      </div>

      {/* Candidates list */}
      {tab === "candidates" && (
        <div className="space-y-3">
          {shopping.length === 0 && (
            <div className="surface p-4 text-xs text-muted-foreground">
              No shopping candidates. Use the ROI Calculator to add items.
            </div>
          )}
          {shopping.map((item) => (
            <div key={item.id} className="surface p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">{item.item_name}</div>
                  <div className="mono-label mt-0.5">{item.brand ?? "–"} · {item.category ?? "–"}</div>
                </div>
                {item.roi_score !== undefined && (
                  <div className={`text-lg font-semibold ${item.roi_score >= 65 ? "text-green-400" : item.roi_score >= 40 ? "text-amber-400" : "text-red-400"}`}>
                    {Math.round(item.roi_score)}
                  </div>
                )}
              </div>

              {item.estimated_price && (
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="surface p-2">
                    <div className="mono-label">Price</div>
                    <div className="font-semibold text-sm">₹{item.estimated_price}</div>
                  </div>
                  <div className="surface p-2">
                    <div className="mono-label">Cost/Wear</div>
                    <div className="font-semibold text-sm">₹{item.cost_per_wear?.toFixed(0) ?? "–"}</div>
                  </div>
                  <div className="surface p-2">
                    <div className="mono-label">Unlocks</div>
                    <div className="font-semibold text-sm">{item.unlock_count}</div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Btn variant="primary" onClick={() => updateStatus(item.id, "purchased")}>Purchased</Btn>
                <Btn variant="secondary" onClick={() => updateStatus(item.id, "rejected")}>Reject</Btn>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ROI Calculator */}
      {tab === "roi" && (
        <div className="space-y-4">
          <Field label="Item Name">
            <input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="e.g. Olive Linen Blazer" className="w-full rounded-xl border border-border bg-card px-3 py-3 text-sm outline-none" />
          </Field>

          <Field label="Category">
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button key={c} onClick={() => setCategory(c)} className="chip" data-active={category === c ? "true" : "false"}>{c}</button>
              ))}
            </div>
          </Field>

          <Field label="Price (₹)">
            <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 4500" className="w-full rounded-xl border border-border bg-card px-3 py-3 text-sm outline-none" />
          </Field>

          <Field label="Season Coverage">
            <div className="flex gap-2 flex-wrap">
              {SEASONS.map((s) => (
                <button key={s} onClick={() => setSeasons((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])} className="chip" data-active={seasons.includes(s) ? "true" : "false"}>{s}</button>
              ))}
            </div>
          </Field>

          <Field label="Occasions">
            <div className="flex gap-2 flex-wrap">
              {OCCASIONS.map((o) => (
                <button key={o} onClick={() => setOccasions((prev) => prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o])} className="chip" data-active={occasions.includes(o) ? "true" : "false"}>{o.replace("_", " ")}</button>
              ))}
            </div>
          </Field>

          <Field label="Maintenance">
            <div className="flex gap-2">
              {MAINTENANCE.map((m) => (
                <button key={m} onClick={() => setMaintenance(m)} className="chip" data-active={maintenance === m ? "true" : "false"}>{m}</button>
              ))}
            </div>
          </Field>

          <Btn onClick={handleROI} disabled={roiLoading || !itemName || !price}>
            {roiLoading ? "Calculating..." : "Calculate ROI"}
          </Btn>

          {roiResult && (
            <div className="surface space-y-3 p-4">
              <div className="flex items-center justify-between">
                <div className="mono-label">ROI Score</div>
                <div className={`text-2xl font-semibold ${verdictColor[roiResult.verdict]}`}>
                  {roiResult.roi_score}
                </div>
              </div>
              <div className={`text-sm font-semibold uppercase tracking-wider ${verdictColor[roiResult.verdict]}`}>
                {roiResult.verdict}
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="surface p-2">
                  <div className="mono-label">Unlocks</div>
                  <div className="font-semibold">{roiResult.unlock_count}</div>
                </div>
                <div className="surface p-2">
                  <div className="mono-label">Wears/yr</div>
                  <div className="font-semibold">{roiResult.estimated_wears_per_year}</div>
                </div>
                <div className="surface p-2">
                  <div className="mono-label">Cost/Wear</div>
                  <div className="font-semibold">₹{roiResult.cost_per_wear}</div>
                </div>
              </div>

              {roiResult.reasoning.length > 0 && (
                <ul className="space-y-1">
                  {roiResult.reasoning.map((r, i) => (
                    <li key={i} className="text-xs text-muted-foreground">• {r}</li>
                  ))}
                </ul>
              )}

              {roiResult.verdict !== "reject" && (
                <Btn onClick={async () => {
                  await fetch("/api/shopping", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      item_name: itemName, category,
                      estimated_price: Number(price),
                      roi_score: roiResult.roi_score,
                      cost_per_wear: roiResult.cost_per_wear,
                      unlock_count: roiResult.unlock_count,
                      season_coverage: JSON.stringify(seasons),
                      occasion_coverage: JSON.stringify(occasions),
                      maintenance_cost: maintenance,
                    }),
                  });
                  await refreshShopping();
                  setTab("candidates");
                }}>
                  Add to Shopping List
                </Btn>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
