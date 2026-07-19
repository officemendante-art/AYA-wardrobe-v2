import { useState, useEffect, useMemo } from "react";
import { useStore } from "@/lib/store";
import type { GalleryImage } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";
import { Masonry } from "masonic";
import { X, Search, Plus } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// MASONRY GRID ITEM
// ─────────────────────────────────────────────────────────────────────────────
const GalleryGridItem = ({ data: img }: { data: GalleryImage }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="group relative cursor-pointer overflow-hidden bg-secondary"
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
      </div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export function GalleryScreen() {
  const { galleryImages, collections } = useStore();
  const [q, setQ] = useState("");
  const [activeCollection, setActiveCollection] = useState<string | null>(null);
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

  // Compute collection filtered logic
  const getCollectionImages = (collectionId: string) => {
    return galleryImages.filter((img) => {
      const haystack = `${img.title} ${img.occasion} ${img.season} ${img.style} ${img.primary_colors} ${img.fabric} ${img.notes} ${img.dna}`.toLowerCase();
      if (collectionId === "favorites") return img.is_favorite === 1;
      if (collectionId !== "all") {
        const coll = collections.find((c) => c.id === collectionId);
        if (coll && !haystack.includes(coll.name.toLowerCase())) return false;
      }
      return true;
    });
  };

  // Filter images based on search query or active collection
  const filtered = useMemo(() => {
    if (q) {
      return galleryImages.filter((img) => {
        const haystack = `${img.title} ${img.occasion} ${img.season} ${img.style} ${img.primary_colors} ${img.fabric} ${img.notes} ${img.dna}`.toLowerCase();
        return haystack.includes(q.toLowerCase());
      });
    }
    if (activeCollection) return getCollectionImages(activeCollection);
    return galleryImages; // for "Recent Photos" if needed
  }, [galleryImages, activeCollection, q, collections]);

  const activeImage = useMemo(() => galleryImages.find((img) => img.id === activeImageId), [galleryImages, activeImageId]);
  
  // Build rich collection previews
  const collectionPreviews = useMemo(() => {
    const defaultColls = [
      { id: "all", name: "All Photos" },
      { id: "favorites", name: "Favorites" },
    ];
    const allColls = [...defaultColls, ...collections.map(c => ({ id: c.id, name: c.name }))];
    
    return allColls.map(coll => {
      const images = getCollectionImages(coll.id);
      return {
        ...coll,
        count: images.length,
        cover: images.length > 0 ? images[0].image_path : null
      };
    }).filter(c => c.count > 0 || c.id === "all"); // Hide empty collections except "All"
  }, [galleryImages, collections]);

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
              placeholder="Search outfits..."
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                if (e.target.value) setActiveCollection(null);
              }}
              className="w-full rounded-full border-0 bg-secondary/50 py-2.5 pl-10 pr-4 text-sm focus:bg-secondary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* COLLECTION PREVIEWS (Grid) */}
        {!activeCollection && !q && (
          <div className="mb-8">
            <h2 className="mb-4 font-serif text-lg text-muted-foreground">Collections</h2>
            <div className="grid grid-cols-2 gap-4">
              {collectionPreviews.map((coll) => (
                <button
                  key={coll.id}
                  onClick={() => setActiveCollection(coll.id)}
                  className="group relative flex aspect-square flex-col justify-end overflow-hidden bg-secondary text-left"
                >
                  {coll.cover ? (
                    <img 
                      src={`/${coll.cover}`} 
                      alt={coll.name} 
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-muted" />
                  )}
                  {/* Dim Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="relative z-10 p-3">
                    <div className="font-serif text-sm font-medium text-white">{coll.name}</div>
                    <div className="text-[10px] text-white/70">{coll.count} outfits</div>
                  </div>
                </button>
              ))}
            </div>
            
            <div className="pt-10 pb-4">
              <h2 className="font-serif text-lg text-muted-foreground">Recent Photos</h2>
            </div>
          </div>
        )}

        {/* ACTIVE COLLECTION HEADER */}
        {(activeCollection || q) && (
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-serif text-xl font-medium">
              {q ? "Search Results" : collectionPreviews.find(f => f.id === activeCollection)?.name}
            </h2>
            <button 
              onClick={() => { setActiveCollection(null); setQ(""); }}
              className="text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-primary"
            >
              Clear
            </button>
          </div>
        )}

        {/* MASONRY GRID (Either Recent Photos or Filtered Photos) */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="font-serif text-lg font-medium">Your Gallery is empty.</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Import Google Flow images<br />or upload your first outfit.
            </p>
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
          FLOATING ACTION BUTTON
          ───────────────────────────────────────────────────────────── */}
      <div className={`fixed bottom-24 right-6 z-40 transition-opacity duration-300 ${activeImageId ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
        <button 
          onClick={() => { /* Open upload/import menu */ }}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform hover:scale-105 active:scale-95"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          IN-PLACE EXPANDING IMAGE VIEWER (SHARED ELEMENT)
          ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {activeImageId && activeImage && (
          <motion.div
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(20px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-50 overflow-y-auto bg-background/80"
          >
            {/* Close Hitbox (Top area) */}
            <div 
              className="fixed left-0 right-0 top-0 z-50 flex h-20 items-center justify-start p-4 bg-gradient-to-b from-black/30 to-transparent"
              onClick={() => setActiveImageId(null)}
            >
              <button className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition-colors hover:bg-black/60">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="pb-24 md:pb-0 md:flex md:h-[100dvh] md:w-full md:items-center md:gap-8 md:px-12 md:pt-20">
              {/* Hero Image (Shared Element) */}
              <div 
                className="relative w-full cursor-pointer overflow-hidden md:w-1/2 md:flex-shrink-0"
                onClick={() => setActiveImageId(null)}
              >
                <motion.img
                  layoutId={`image-${activeImage.id}`}
                  src={`/${activeImage.image_path}`}
                  alt={activeImage.title || "Outfit"}
                  className="w-full h-auto max-h-[75vh] md:max-h-[85vh] object-contain drop-shadow-2xl"
                />
              </div>

              {/* Minimal Metadata Reveal */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                className="mx-auto max-w-2xl px-6 pt-6 md:w-1/2 md:h-full md:overflow-y-auto md:pb-24 md:pt-12"
              >
                <h2 className="font-serif text-2xl font-medium tracking-tight">{activeImage.title || "Untitled Outfit"}</h2>
                
                <div className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-sm text-muted-foreground">
                  {activeImage.occasion && <span>{activeImage.occasion}</span>}
                  {activeImage.occasion && activeImage.season && <span>•</span>}
                  {activeImage.season && <span>{activeImage.season}</span>}
                </div>
                
                <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-sm font-medium text-foreground">
                  {activeImage.primary_colors && <span>{activeImage.primary_colors.replace(/,/g, ' • ')}</span>}
                  {activeImage.primary_colors && activeImage.fabric && <span>•</span>}
                  {activeImage.fabric && <span>{activeImage.fabric.replace(/,/g, ' • ')}</span>}
                </div>

                <div className="my-6 h-px w-full bg-border" />

                <button 
                  onClick={() => setShowFullDetails(!showFullDetails)}
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
                >
                  Show Details
                </button>

                {/* Extended Details Drawer */}
                <AnimatePresence>
                  {showFullDetails && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-8 pt-8 pb-12">
                        {activeImage.dna && (
                          <div>
                            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">DNA</h3>
                            <p className="font-serif text-base leading-relaxed text-foreground">{activeImage.dna.replace(/,/g, '\n')}</p>
                          </div>
                        )}
                        
                        {activeImage.secondary_colors && (
                          <div>
                            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Pantone</h3>
                            <p className="font-serif text-base text-foreground">{activeImage.secondary_colors}</p>
                          </div>
                        )}

                        {activeImage.fabric && (
                          <div>
                            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Fabric</h3>
                            <p className="font-serif text-base text-foreground">{activeImage.fabric}</p>
                          </div>
                        )}

                        {activeImage.notes && (
                          <div>
                            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Notes</h3>
                            <p className="font-serif text-base leading-relaxed text-foreground whitespace-pre-wrap">{activeImage.notes}</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
