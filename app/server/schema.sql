-- ============================================================
-- AYA FASHION INTELLIGENCE OS v1.0 — SQLite Schema
-- All tables. All relationships. Single source of truth.
-- ============================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ============================================================
-- META: Schema versioning
-- ============================================================

CREATE TABLE IF NOT EXISTS SchemaVersion (
  id            INTEGER PRIMARY KEY DEFAULT 1,
  schema_ver    INTEGER NOT NULL DEFAULT 1,
  migration_ver INTEGER NOT NULL DEFAULT 1,
  knowledge_ver INTEGER NOT NULL DEFAULT 1,
  app_ver       TEXT    NOT NULL DEFAULT '1.0.0',
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO SchemaVersion (id) VALUES (1);

-- ============================================================
-- SETTINGS: App configuration (key/value store)
-- ============================================================

CREATE TABLE IF NOT EXISTS Settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO Settings (key, value) VALUES
  ('dark_mode',    'false'),
  ('font_size',    'comfort'),
  ('wardrobe_name','AYA'),
  ('owner_name',   ''),
  ('gemini_api_key',''),
  ('api_validated','false');

-- ============================================================
-- IDENTITY: Core user profile (single row, never deleted)
-- ============================================================

CREATE TABLE IF NOT EXISTS Identity (
  id               INTEGER PRIMARY KEY DEFAULT 1,
  name             TEXT,
  body_type        TEXT,
  height_cm        INTEGER,
  weight_kg        INTEGER,
  skin_tone        TEXT,
  skin_undertone   TEXT,    -- warm | cool | neutral
  style_philosophy TEXT,
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO Identity (id) VALUES (1);

-- ============================================================
-- RULES: All system rules by layer
-- ============================================================

CREATE TABLE IF NOT EXISTS Rules (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  layer      TEXT NOT NULL,   -- identity | body | color | fabric | style | occasion | shopping
  rule       TEXT NOT NULL,
  priority   INTEGER NOT NULL DEFAULT 5,  -- 1=highest, 10=lowest
  source     TEXT,            -- e.g. AYA_IDENTITY_LOCK_V1.md
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rules_layer ON Rules(layer);
CREATE INDEX IF NOT EXISTS idx_rules_active ON Rules(active);

-- ============================================================
-- GARMENTS: Core wardrobe inventory
-- ============================================================

CREATE TABLE IF NOT EXISTS Garments (
  id                    TEXT PRIMARY KEY,           -- e.g. TOP-001
  item_name             TEXT NOT NULL,
  category              TEXT NOT NULL,              -- tops | bottoms | outerwear | shoes | watches | eyewear | jewelry | bags | belts | accessories
  type                  TEXT,                       -- shirt | trousers | jacket | etc.
  image_path            TEXT,                       -- relative: data/images/{id}.jpg
  archived              INTEGER NOT NULL DEFAULT 0,
  deleted               INTEGER NOT NULL DEFAULT 0,
  -- Extended attributes
  collar_type           TEXT,
  sleeve_type           TEXT,
  buttons               TEXT,
  texture               TEXT,
  visual_weight         TEXT,                       -- light | medium | heavy
  layering_suitability  TEXT,                       -- base | mid | outer
  luxury_score          REAL,                       -- 0-100
  minimalism_score      REAL,                       -- 0-100
  photogenic_score      REAL,                       -- 0-100
  ai_confidence_overall REAL,
  -- Lifecycle
  condition             TEXT DEFAULT 'good',        -- good | fair | repair | donate | archived
  purchase_price        REAL,
  purchase_date         TEXT,
  brand                 TEXT,
  wardrobe_id           INTEGER DEFAULT 1,          -- future: multiple wardrobes
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  modified_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_garments_category   ON Garments(category);
CREATE INDEX IF NOT EXISTS idx_garments_deleted     ON Garments(deleted);
CREATE INDEX IF NOT EXISTS idx_garments_archived    ON Garments(archived);
CREATE INDEX IF NOT EXISTS idx_garments_wardrobe    ON Garments(wardrobe_id);

-- ============================================================
-- COLORS: Normalized color data per garment
-- ============================================================

CREATE TABLE IF NOT EXISTS Colors (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  garment_id  TEXT NOT NULL REFERENCES Garments(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,       -- primary | secondary | accent | stripe | trim | logo | pattern
  name        TEXT NOT NULL,
  hex         TEXT NOT NULL,
  confidence  REAL NOT NULL DEFAULT 1.0
);

CREATE INDEX IF NOT EXISTS idx_colors_garment ON Colors(garment_id);

-- ============================================================
-- ATTRIBUTES: Flexible key/value attributes per garment
-- ============================================================

CREATE TABLE IF NOT EXISTS Attributes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  garment_id TEXT NOT NULL REFERENCES Garments(id) ON DELETE CASCADE,
  key        TEXT NOT NULL,        -- pattern | formality | fit | material | season | occasion | weather
  value      TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 1.0,
  status     TEXT NOT NULL DEFAULT 'known'  -- known | likely | unknown
);

CREATE INDEX IF NOT EXISTS idx_attributes_garment ON Attributes(garment_id);
CREATE INDEX IF NOT EXISTS idx_attributes_key     ON Attributes(key);

-- ============================================================
-- GARMENT DNA: Personality dimensions per garment
-- ============================================================

CREATE TABLE IF NOT EXISTS GarmentDNA (
  garment_id TEXT    NOT NULL REFERENCES Garments(id) ON DELETE CASCADE,
  dimension  TEXT    NOT NULL,     -- Authority | Luxury | Minimalism | Warmth | Confidence | Creativity | Professionalism | VisualWeight | Contrast | Texture | Formality | Traditional | Modern | Experimental | Approachability | Photogenic | Complexity
  score      REAL    NOT NULL,     -- 0.0 - 100.0
  PRIMARY KEY (garment_id, dimension)
);

CREATE INDEX IF NOT EXISTS idx_garment_dna_garment ON GarmentDNA(garment_id);



-- ============================================================
-- OUTFITS: Assembled outfit records
-- ============================================================

CREATE TABLE IF NOT EXISTS Outfits (
  id                 TEXT PRIMARY KEY,
  name               TEXT,
  occasion           TEXT,
  season             TEXT,
  weather            TEXT,
  mood               TEXT,
  temperature_c      INTEGER,
  dress_code         TEXT,
  similarity_score   REAL,         -- vs. last 10 outfits (0-100, rejected if >70)
  diversity_approved INTEGER NOT NULL DEFAULT 1,
  ai_reasoning       TEXT,         -- Gemini's explanation
  image_prompt       TEXT,         -- generated image prompt
  wardrobe_id        INTEGER DEFAULT 1,
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_outfits_occasion ON Outfits(occasion);

-- ============================================================
-- OUTFIT ITEMS: Which garments are in each outfit
-- ============================================================

CREATE TABLE IF NOT EXISTS OutfitItems (
  outfit_id  TEXT NOT NULL REFERENCES Outfits(id) ON DELETE CASCADE,
  garment_id TEXT NOT NULL REFERENCES Garments(id),
  role       TEXT NOT NULL,        -- top | bottom | outerwear | shoes | accessory | watch | eyewear
  PRIMARY KEY (outfit_id, garment_id)
);

-- ============================================================
-- OUTFIT DNA: Aggregated DNA per outfit
-- ============================================================

CREATE TABLE IF NOT EXISTS OutfitDNA (
  outfit_id TEXT NOT NULL REFERENCES Outfits(id) ON DELETE CASCADE,
  dimension TEXT NOT NULL,
  score     REAL NOT NULL,
  PRIMARY KEY (outfit_id, dimension)
);

-- ============================================================
-- GALLERY IMAGES: The visual fashion cards
-- ============================================================

CREATE TABLE IF NOT EXISTS GalleryImages (
  id             TEXT PRIMARY KEY,
  title          TEXT,
  image_path     TEXT NOT NULL,
  occasion       TEXT,
  season         TEXT,
  style          TEXT,
  primary_colors TEXT,
  secondary_colors TEXT,
  fabric         TEXT,
  fit            TEXT,
  notes          TEXT,
  dna            TEXT,            -- JSON array or summary
  similarity_score REAL,
  is_favorite    INTEGER NOT NULL DEFAULT 0,
  source         TEXT NOT NULL DEFAULT 'manual', -- imported | camera | Flow
  prompt         TEXT,            -- if generated
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- COLLECTIONS: Folders for organizing gallery images
-- ============================================================

CREATE TABLE IF NOT EXISTS Collections (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ImageCollections (
  image_id      TEXT NOT NULL REFERENCES GalleryImages(id) ON DELETE CASCADE,
  collection_id TEXT NOT NULL REFERENCES Collections(id) ON DELETE CASCADE,
  PRIMARY KEY (image_id, collection_id)
);

-- ============================================================
-- INTERACTIONS: User behavior log (for scoring over time)
-- ============================================================

CREATE TABLE IF NOT EXISTS Interactions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,      -- outfit | garment | suggestion | purchase | experiment
  entity_id   TEXT NOT NULL,
  action      TEXT NOT NULL,      -- worn | rejected | saved | deleted | purchased | approved | tried
  context     TEXT,               -- JSON: {occasion, weather, mood}
  notes       TEXT,
  timestamp   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_interactions_entity ON Interactions(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_interactions_action  ON Interactions(action);



-- ============================================================
-- WARDROBES: Future multi-wardrobe support (unused now)
-- ============================================================

CREATE TABLE IF NOT EXISTS Wardrobes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,           -- Home | Travel | Formal | etc.
  description TEXT,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO Wardrobes (id, name, description) VALUES (1, 'Main', 'Primary wardrobe');

-- ============================================================
-- BRANDS: Brand catalog for shopping intelligence
-- ============================================================

CREATE TABLE IF NOT EXISTS Brands (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL UNIQUE,
  tier         TEXT,                   -- luxury | premium | mid | affordable | fast-fashion
  dna_affinity TEXT,                   -- JSON: which DNA dimensions this brand scores high on
  notes        TEXT
);

-- ============================================================
-- RESEARCH: Ingested knowledge from PDFs, articles, docs
-- ============================================================

CREATE TABLE IF NOT EXISTS Research (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  source      TEXT NOT NULL,           -- filename or URL
  content     TEXT NOT NULL,
  tags        TEXT,                    -- JSON array
  source_type TEXT NOT NULL DEFAULT 'document', -- document | web | manual | pdf
  ingested_at TEXT NOT NULL DEFAULT (datetime('now'))
);


-- ============================================================
-- JOBS: Background job queue
-- ============================================================

CREATE TABLE IF NOT EXISTS Jobs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type        TEXT NOT NULL,           -- analyze_garment | analyze_flow_archive | compile_knowledge | seed_db | backup | restore | research_ingest
  status      TEXT NOT NULL DEFAULT 'queued', -- queued | running | done | failed | cancelled
  progress    INTEGER NOT NULL DEFAULT 0,     -- 0-100
  total_items INTEGER DEFAULT 0,
  done_items  INTEGER DEFAULT 0,
  payload     TEXT,                    -- JSON input params
  result      TEXT,                    -- JSON result summary
  error       TEXT,
  started_at  TEXT,
  finished_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON Jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_type   ON Jobs(type);

-- ============================================================
-- ACTIVITY LOG: Human-readable audit trail
-- ============================================================

CREATE TABLE IF NOT EXISTS ActivityLog (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  level      TEXT NOT NULL DEFAULT 'info',  -- info | warning | error | success
  category   TEXT NOT NULL,                  -- garment | outfit | ai | system | shopping | research
  message    TEXT NOT NULL,
  details    TEXT,                            -- JSON extra context
  entity_id  TEXT,
  timestamp  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_activity_category  ON ActivityLog(category);
CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON ActivityLog(timestamp);

-- ============================================================
-- KNOWLEDGE SOURCES: Track what has been ingested
-- ============================================================

CREATE TABLE IF NOT EXISTS KnowledgeSources (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  filename      TEXT NOT NULL,
  source_type   TEXT NOT NULL,      -- docx | md | pdf | json | image
  file_hash     TEXT,               -- SHA256 of file contents
  record_count  INTEGER DEFAULT 0,
  ingested_at   TEXT NOT NULL DEFAULT (datetime('now')),
  status        TEXT NOT NULL DEFAULT 'done' -- done | failed | skipped
);

-- ============================================================
-- WISH LIST: Future items to track (not yet shopping candidates)
-- ============================================================

CREATE TABLE IF NOT EXISTS WishList (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  item_name  TEXT NOT NULL,
  brand      TEXT,
  notes      TEXT,
  image_url  TEXT,
  added_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- OUTFIT RATINGS: User rating of generated outfits
-- ============================================================

CREATE TABLE IF NOT EXISTS OutfitRatings (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  outfit_id  TEXT NOT NULL REFERENCES Outfits(id) ON DELETE CASCADE,
  rating     INTEGER NOT NULL,     -- 1-5
  comment    TEXT,
  rated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- ANALYTICS CACHE: Pre-computed analytics (refreshed by compiler)
-- ============================================================

CREATE TABLE IF NOT EXISTS AnalyticsCache (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,          -- JSON value
  computed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
