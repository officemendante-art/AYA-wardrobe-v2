import { useEffect } from "react";
import { ScreenHeader } from "@/components/ui-bits";
import { useStore } from "@/lib/store";
import { primaryColor, attributeValue } from "@/lib/types";

export function Home() {
  const { status, refreshStatus, galleryImages, navigate } = useStore();

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const counts = status?.counts;
  const recentPhotos = galleryImages.slice(0, 4);

  const tiles = [
    { label: "Scan Cloth", sub: "AI Analysis", icon: "□", action: () => navigate({ name: "capture" }) },
    { label: "Gallery", sub: `${galleryImages.length} photos`, icon: "▦", action: () => navigate({ name: "gallery" }) },
    { label: "Activity", sub: "Log", icon: "≡", action: () => navigate({ name: "activity" }) },
  ];

  const dbStats = counts ? [
    { label: "Wardrobe", value: counts.garments },
    { label: "Outfits", value: counts.outfits },
  ] : [];

  return (
    <div className="screen-pad">
      <ScreenHeader title="AYA OS" subtitle="Fashion Intelligence System v1.0" />

      {/* DB Health */}
      {dbStats.length > 0 && (
        <section className="mb-5">
          <div className="mono-label mb-2">Database</div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {dbStats.map((stat) => (
              <div
                key={stat.label}
                className={`surface p-3 ${stat.alert ? "border-amber-400/60" : ""}`}
              >
                <div className="mono-label">{stat.label}</div>
                <div
                  className={`font-data mt-1 text-lg font-semibold ${stat.alert ? "text-amber-400" : ""}`}
                  data-numeric="true"
                >
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}



      {/* Main Actions */}
      <div className="mt-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {tiles.map((tile) => (
          <button
            key={tile.label}
            onClick={tile.action}
            className="surface flex aspect-square flex-col justify-between p-4 text-left transition-colors hover:bg-secondary"
          >
            <span className="text-2xl leading-none text-muted-foreground">{tile.icon}</span>
            <div>
              <div className="text-sm font-semibold uppercase leading-tight tracking-wider">{tile.label}</div>
              <div className="mono-label mt-1">{tile.sub}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Recent Photos */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="mono-label">Recent Photos</h2>
          <button onClick={() => navigate({ name: "gallery" })} className="text-[11px] uppercase tracking-wider text-muted-foreground">
            All →
          </button>
        </div>
        <div className="surface divide-hair overflow-hidden">
          {recentPhotos.length === 0 && (
            <div className="p-4 text-xs text-muted-foreground">
              No photos yet.
            </div>
          )}
          {recentPhotos.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate({ name: "details", id: item.id })}
              className="flex w-full items-center gap-3 p-3 text-left hover:bg-secondary"
            >
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-secondary">
                {item.image_path ? (
                  <img src={`/${item.image_path}`} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-[#888]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{item.title || "Untitled Outfit"}</div>
                <div className="truncate text-[11px] uppercase tracking-wider text-muted-foreground">
                  {item.source}
                </div>
              </div>
              {item.is_favorite === 1 && (
                <div className="shrink-0 text-xs">❤️</div>
              )}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
