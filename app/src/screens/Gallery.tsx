import { useState, useEffect, useMemo } from "react";
import { ScreenHeader, TextInput } from "@/components/ui-bits";
import { useStore } from "@/lib/store";
import type { GalleryImage } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";
import { Masonry } from "masonic";
import { Folder, Heart, X, Search, ChevronDown, ChevronUp } from "lucide-react";

// The masonry grid item component
const GalleryGridItem = ({ data: img }: { data: GalleryImage }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div
      className="group relative cursor-pointer overflow-hidden rounded-xl bg-secondary transition-transform duration-300 hover:scale-[1.02] active:scale-95"
      onClick={() => window.dispatchEvent(new CustomEvent("open-image", { detail: img.id }))}
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden">
        {/* Loading Skeleton */}
        {!loaded && !error && (
          <div className="absolute inset-0 animate-pulse bg-muted" />
        )}
        
        {img.image_path && !error ? (
          <motion.img
            layoutId={`image-${img.id}`}
            src={`/${img.image_path}`}
            alt={img.title || "Outfit"}
            className={`h-full w-full object-cover transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-secondary opacity-50 text-muted-foreground">
            <span className="mb-2 text-2xl">Y-?</span>
          </div>
        )}

        {/* Favorite Badge */}
        {img.is_favorite === 1 && (
          <div className="absolute right-2 top-2 drop-shadow-md text-white">
            <Heart className="h-5 w-5 fill-white text-white" />
          </div>
        )}
      </div>
    </div>
  );
};

export function GalleryScreen() {
  const { galleryImages, collections } = useStore();
  const [q, setQ] = useState("");
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [showFullDetails, setShowFullDetails] = useState(false);

  // Listen for the custom event to open an image
  useEffect(() => {
    const handleOpen = (e: any) => {
      setActiveImageId(e.detail);
      setShowFullDetails(false); // Reset details state when opening new image
    };
    window.addEventListener("open-image", handleOpen);
    return () => window.removeEventListener("open-image", handleOpen);
  }, []);

  // Filter images based on folder and search query
  const filtered = useMemo(() => {
    return galleryImages.filter((img) => {
      const haystack = `${img.title} ${img.occasion} ${img.season} ${img.style} ${img.primary_colors} ${img.fabric} ${img.notes}`.toLowerCase();
      if (q && !haystack.includes(q.toLowerCase())) return false;
      
      if (activeFolder === "favorites") return img.is_favorite === 1;
      if (activeFolder && activeFolder !== "all") {
        const coll = collections.find((c) => c.id === activeFolder);
        if (coll && !haystack.includes(coll.name.toLowerCase())) return false;
      }
      return true;
    });
  }, [galleryImages, activeFolder, q, collections]);

  const activeImage = useMemo(() => galleryImages.find((img) => img.id === activeImageId), [galleryImages, activeImageId]);
  
  // Folder list structure
  const folders = [
    { id: "all", name: "All Photos", icon: <Folder className="h-4 w-4" /> },
    { id: "favorites", name: "Favorites", icon: <Heart className="h-4 w-4" /> },
    ...collections.map(c => ({ id: c.id, name: c.name, icon: <Folder className="h-4 w-4" /> }))
  ];

  return (
    <div className="relative min-h-screen pb-20">
      
      {/* ─────────────────────────────────────────────────────────────
          MAIN GALLERY VIEW
          ───────────────────────────────────────────────────────────── */}
      <div className={`screen-pad transition-opacity duration-300 ${activeImageId ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
        
        {/* Header & Search */}
        <div className="mb-6 space-y-4 pt-4">
          <h1 className="font-serif text-3xl font-medium tracking-tight">Gallery</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search archive..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full rounded-full border-0 bg-secondary/50 py-2.5 pl-10 pr-4 text-sm focus:bg-secondary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* FOLDER-FIRST VIEW */}
        {!activeFolder && !q && (
          <div className="mb-8 space-y-2">
            {folders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => setActiveFolder(folder.id)}
                className="flex w-full items-center gap-4 rounded-2xl p-4 transition-colors hover:bg-secondary/50 active:bg-secondary"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                  {folder.icon}
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium">{folder.name}</div>
                </div>
              </button>
            ))}
            
            <div className="pt-8 pb-4">
              <h2 className="font-serif text-lg text-muted-foreground">Recent Photos</h2>
            </div>
          </div>
        )}

        {/* ACTIVE FOLDER HEADER */}
        {(activeFolder || q) && (
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-serif text-xl font-medium">
              {q ? "Search Results" : folders.find(f => f.id === activeFolder)?.name}
            </h2>
            <button 
              onClick={() => { setActiveFolder(null); setQ(""); }}
              className="text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-primary"
            >
              Clear
            </button>
          </div>
        )}

        {/* MASONRY GRID (Either Recent Photos or Filtered Photos) */}
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No images found in this collection.
          </div>
        ) : (
          <div className="pb-8">
            <Masonry
              items={filtered}
              render={GalleryGridItem}
              columnGutter={12}
              columnWidth={160}
              overscanBy={2}
            />
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          IN-PLACE EXPANDING IMAGE VIEWER (SHARED ELEMENT)
          ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {activeImageId && activeImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 overflow-y-auto bg-background"
          >
            {/* Close Hitbox (Top area) */}
            <div 
              className="absolute left-0 right-0 top-0 z-50 flex h-20 items-center justify-start p-4 bg-gradient-to-b from-black/20 to-transparent"
              onClick={() => setActiveImageId(null)}
            >
              <button className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition-colors hover:bg-black/60">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Hero Image (Shared Element) */}
            <div 
              className="relative w-full cursor-pointer bg-secondary"
              onClick={() => setActiveImageId(null)}
            >
              <motion.img
                layoutId={`image-${activeImage.id}`}
                src={`/${activeImage.image_path}`}
                alt={activeImage.title || "Outfit"}
                className="w-full h-[65vh] object-cover"
              />
            </div>

            {/* Short Metadata Reveal */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="mx-auto max-w-2xl p-6"
            >
              <h2 className="font-serif text-2xl font-medium">{activeImage.title || "Untitled Outfit"}</h2>
              
              <div className="mt-4 flex flex-wrap gap-x-2 gap-y-1 text-sm text-muted-foreground">
                {activeImage.occasion && <span>{activeImage.occasion}</span>}
                {activeImage.occasion && activeImage.season && <span>•</span>}
                {activeImage.season && <span>{activeImage.season}</span>}
              </div>
              
              <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-sm font-medium text-primary">
                {activeImage.primary_colors && <span>{activeImage.primary_colors.replace(/,/g, ' • ')}</span>}
                {activeImage.primary_colors && activeImage.fabric && <span>•</span>}
                {activeImage.fabric && <span>{activeImage.fabric.replace(/,/g, ' • ')}</span>}
              </div>

              <div className="mt-8 border-t border-border pt-2">
                <button 
                  onClick={() => setShowFullDetails(!showFullDetails)}
                  className="flex w-full items-center justify-center gap-2 py-4 text-sm font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-primary"
                >
                  {showFullDetails ? (
                    <>Hide Details <ChevronUp className="h-4 w-4" /></>
                  ) : (
                    <>Show Details <ChevronDown className="h-4 w-4" /></>
                  )}
                </button>
              </div>

              {/* Extended Details */}
              <AnimatePresence>
                {showFullDetails && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-6 pb-12 pt-4">
                      {activeImage.dna && (
                        <div>
                          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">DNA</h3>
                          <p className="text-sm leading-relaxed">{activeImage.dna}</p>
                        </div>
                      )}
                      
                      {activeImage.notes && (
                        <div>
                          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Notes</h3>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{activeImage.notes}</p>
                        </div>
                      )}
                      
                      {activeImage.secondary_colors && (
                        <div>
                          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Secondary Colors</h3>
                          <p className="text-sm">{activeImage.secondary_colors}</p>
                        </div>
                      )}

                      {activeImage.fit && (
                        <div>
                          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Fit</h3>
                          <p className="text-sm">{activeImage.fit}</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
