import { useEffect } from "react";
import { Btn, ScreenHeader } from "@/components/ui-bits";
import { useStore } from "@/lib/store";

const LEVEL_COLOR: Record<string, string> = {
  info: "text-muted-foreground",
  success: "text-green-400",
  warning: "text-amber-400",
  error: "text-red-400",
};

export function ActivityScreen() {
  const { activity, refreshActivity } = useStore();

  useEffect(() => { refreshActivity(); }, [refreshActivity]);

  return (
    <div className="screen-pad">
      <ScreenHeader
        title="Activity Log"
        subtitle="Audit trail"
        right={
          <Btn variant="ghost" onClick={refreshActivity} className="w-auto px-3 py-1 text-[10px]">
            Refresh
          </Btn>
        }
      />

      {activity.length === 0 && (
        <div className="surface p-4 text-xs text-muted-foreground">No activity yet.</div>
      )}

      <div className="surface divide-hair overflow-hidden">
        {activity.map((entry) => (
          <div key={entry.id} className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] uppercase tracking-wider ${LEVEL_COLOR[entry.level]}`}>
                    {entry.level}
                  </span>
                  <span className="text-[10px] text-muted-foreground">·</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {entry.category}
                  </span>
                </div>
                <div className="mt-0.5 text-xs">{entry.message}</div>
                {entry.entity_id && (
                  <div className="text-[10px] text-muted-foreground">{entry.entity_id}</div>
                )}
              </div>
              <div className="shrink-0 text-[10px] text-muted-foreground whitespace-nowrap">
                {new Date(entry.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
