import { useState } from "react";
import { Btn, ScreenHeader, TextInput, HybridSlider, Chip } from "@/components/ui-bits";
import { useStore } from "@/lib/store";
import type { GalleryImage, Collection } from "@/lib/types";

export function GalleryScreen() {
  const { galleryImages, collections, navigate } = useStore();
  const [q, setQ] = useState("");
  const [activeCollection, setActiveCollection] = useState<string | null>(null);

  // Filter images based on search and selected collection
  const filtered = galleryImages.filter((img) => {
    // Search filter
    const haystack = `${img.title} ${img.occasion} ${img.season} ${img.style} ${img.primary_colors} ${img.fabric} ${img.notes}`.toLowerCase();
    if (q && !haystack.includes(q.toLowerCase())) return false;
    
    // Collection filter (Favorites is a special case)
    if (activeCollection === "favorites") return img.is_favorite === 1;
    if (activeCollection) {
      const coll = collections.find(c => c.id === activeCollection);
      if (coll && !haystack.includes(coll.name.toLowerCase())) return false;
    }
    
    return true;
  });

  return (
    <div className="screen-pad">
      <ScreenHeader
        title="Gallery"
        subtitle={`${filtered.length} photos`}
        right={
          <button
            className="text-[11px] uppercase tracking-wider text-foreground font-semibold flex items-center gap-1 bg-secondary px-3 py-1.5 rounded-full"
            onClick={() => { /* Open Add Outfit flow */ }}
          >
            + NEW
          </button>
        }
      />

      <TextInput
        placeholder="Search by color, season, fabric..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <HybridSlider className="mt-4 pb-2" innerClassName="gap-2">
        <Chip active={!activeCollection} onClick={() => setActiveCollection(null)}>All</Chip>
        <Chip active={activeCollection === "favorites"} onClick={() => setActiveCollection("favorites")}>
          Favorites ❤️
        </Chip>
        {collections.map((c) => (
          <Chip key={c.id} active={activeCollection === c.id} onClick={() => setActiveCollection(c.id)}>
            📁 {c.name}
          </Chip>
        ))}
      </HybridSlider>

      <div className="mt-4">
        {filtered.length === 0 && (
          <div className="surface p-6 text-center text-xs text-muted-foreground">
            No images found.
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {filtered.map((img) => (
            <GalleryGridItem key={img.id} img={img} onClick={() => navigate({ name: "details", id: img.id })} />
          ))}
        </div>
      </div>
    </div>
  );
}

function GalleryGridItem({ img, onClick }: { img: GalleryImage; onClick: () => void }) {
  const [error, setError] = useState(false);

  return (
    <div 
      className="relative aspect-[3/4] overflow-hidden rounded-xl bg-secondary tap cursor-pointer"
      onClick={onClick}
    >
      {img.image_path && !error ? (
        <img 
          src={`/${img.image_path}`} 
          alt={img.title} 
          className="h-full w-full object-cover" 
          loading="lazy" 
          onError={() => setError(true)}
        />
      ) : (
        <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground opacity-50 bg-secondary">
          <span className="text-2xl mb-2">🖼️</span>
          <span className="text-[10px] text-center px-2">{img.title}</span>
        </div>
      )}
      {img.is_favorite === 1 && (
        <div className="absolute top-2 right-2 drop-shadow-md">❤️</div>
      )}
    </div>
  );
}

export function GalleryImageDetails({ id }: { id: string }) {
  const { galleryImages, back } = useStore();
  const img = galleryImages.find((g) => g.id === id);

  if (!img) {
    return (
      <div className="screen-pad">
        <ScreenHeader title="Not Found" onBack={back} />
        <div className="surface p-4 text-xs text-muted-foreground">Image not found.</div>
      </div>
    );
  }

  return (
    <div className="pb-8">
      {/* Big Photo on top */}
      <div className="relative w-full bg-black flex items-center justify-center overflow-hidden">
        <button 
          onClick={back}
          className="absolute top-4 left-4 z-10 h-8 w-8 rounded-full bg-black/50 flex items-center justify-center text-white backdrop-blur-sm"
        >
          ✕
        </button>
        {img.image_path && (
          <img src={`/${img.image_path}`} className="w-full h-auto max-h-[70vh] object-contain" alt="" />
        )}
        {img.is_favorite === 1 && (
          <div className="absolute bottom-4 right-4 text-2xl drop-shadow-lg">❤️</div>
        )}
      </div>

      <div className="screen-pad mt-4 space-y-4">
        <div>
          <h1 className="text-xl font-bold">{img.title || "Untitled Outfit"}</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {new Date(img.created_at).toLocaleDateString()} · {img.source}
          </p>
        </div>

        {/* Essential Info List */}
        <div className="surface divide-hair overflow-hidden">
          {[
            ["Occasion", img.occasion],
            ["Season", img.season],
            ["Style", img.style],
            ["Primary Colors", img.primary_colors],
            ["Secondary Colors", img.secondary_colors],
            ["Fabric", img.fabric],
            ["Fit", img.fit],
          ].map(([label, value]) => value && (
            <div key={String(label)} className="flex items-center justify-between p-3">
              <span className="text-xs">{label}</span>
              <span className="font-data text-sm font-semibold text-right" data-numeric="false">{value}</span>
            </div>
          ))}
        </div>

        {/* DNA */}
        {img.dna && (
          <div className="surface p-3">
            <div className="text-xs text-muted-foreground mb-2">DNA</div>
            <div className="text-sm leading-relaxed">{img.dna}</div>
          </div>
        )}

        {/* Notes */}
        {img.notes && (
          <div className="surface p-3">
            <div className="text-xs text-muted-foreground mb-2">Notes</div>
            <div className="text-sm leading-relaxed whitespace-pre-wrap">{img.notes}</div>
          </div>
        )}

      </div>
    </div>
  );
}
