import { useEffect } from "react";
import { Btn, ScreenHeader } from "@/components/ui-bits";
import { useStore } from "@/lib/store";
import type { ExplorationItem } from "@/lib/types";

const RISK_COLOR: Record<string, string> = {
  low: "text-green-400",
  medium: "text-amber-400",
  high: "text-red-400",
};

const STATUS_COLOR: Record<string, string> = {
  untested: "text-muted-foreground",
  tried: "text-amber-400",
  approved: "text-green-400",
  rejected: "text-red-400",
};

export function UnknownTerritoryScreen() {
  const { explorations, refreshExplorations } = useStore();

  useEffect(() => { refreshExplorations(); }, [refreshExplorations]);

  const untested = explorations.filter((e) => e.status === "untested");
  const tried = explorations.filter((e) => e.status !== "untested");

  const updateStatus = async (id: number, status: "tried" | "approved" | "rejected", outcome?: string) => {
    await fetch(`/api/unknown-territory/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, outcome }),
    });
    await refreshExplorations();
  };

  const ExperimentCard = ({ item }: { item: ExplorationItem }) => (
    <div className="surface space-y-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="mono-label">
            <span className={RISK_COLOR[item.risk_level]}>{item.risk_level} risk</span>
            {" · "}
            {item.type}
          </div>
          <div className="mt-1 text-sm font-medium">{item.description}</div>
        </div>
        <div className={`text-xs uppercase tracking-wider ${STATUS_COLOR[item.status]}`}>
          {item.status}
        </div>
      </div>

      {item.outcome && (
        <div className="text-xs text-muted-foreground">Outcome: {item.outcome}</div>
      )}

      {item.status === "untested" && (
        <div className="grid grid-cols-3 gap-2">
          <Btn variant="ghost" onClick={() => updateStatus(item.id, "tried")}>Try it</Btn>
          <Btn variant="ghost" onClick={() => updateStatus(item.id, "approved", "Loved it")}>Approve</Btn>
          <Btn variant="ghost" onClick={() => updateStatus(item.id, "rejected", "Not for me")}>Reject</Btn>
        </div>
      )}
      {item.status === "tried" && (
        <div className="grid grid-cols-2 gap-2">
          <Btn variant="ghost" onClick={() => updateStatus(item.id, "approved")}>Approved</Btn>
          <Btn variant="ghost" onClick={() => updateStatus(item.id, "rejected")}>Rejected</Btn>
        </div>
      )}
    </div>
  );

  return (
    <div className="screen-pad space-y-5">
      <ScreenHeader title="Unknown Territory" subtitle="Controlled Style Experiments" />

      <div className="surface p-3 text-xs text-muted-foreground leading-relaxed">
        <strong className="text-foreground">90/10 Rule:</strong> 90% identity, 10% exploration.
        These are low-risk experiments to push your style without losing yourself.
        Try one at a time.
      </div>

      {untested.length > 0 && (
        <section>
          <div className="mono-label mb-3">Untested ({untested.length})</div>
          <div className="space-y-3">
            {untested.map((item) => <ExperimentCard key={item.id} item={item} />)}
          </div>
        </section>
      )}

      {tried.length > 0 && (
        <section>
          <div className="mono-label mb-3">Past Experiments ({tried.length})</div>
          <div className="space-y-3">
            {tried.map((item) => <ExperimentCard key={item.id} item={item} />)}
          </div>
        </section>
      )}

      {explorations.length === 0 && (
        <div className="surface p-4 text-center text-xs text-muted-foreground">
          No experiments yet. Run the Knowledge Compiler in Settings to populate.
        </div>
      )}
    </div>
  );
}
