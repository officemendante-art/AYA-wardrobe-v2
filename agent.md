# AYA OS - Complete Blueprint & Architecture (Agent Documentation)

## Overview
AYA Fashion Intelligence OS is a localized, AI-powered digital wardrobe application. It serves as a visual gallery and analytics platform, completely abstracted away from technical database concepts to provide a sleek, consumer-grade operating system for fashion.

## Navigation Structure

The application operates on a single-page architecture (SPA) powered by React and Vite, anchored by a persistent `BottomNav` stack.

### 1. Home (`Home.tsx`)
**Purpose:** The launchpad of the application.
**Key Elements:**
- **Welcome Message:** "Good Morning, Dante."
- **Outfit Suggestion Widget:** Quick-access widget prompting AI outfit generation.
- **Gallery Preview:** Horizontal scrolling preview of the most recent uploads to the Gallery.
- **Navigation Tiles:** Large, tappable tiles routing the user to `Scan`, `Gallery`, and `Settings`.

### 2. Scan (`Capture.tsx`)
**Purpose:** The ingestion pipeline to add new garments to the Brain.
**Key Elements:**
- **Camera Viewfinder:** Accesses local hardware to snap photos of new garments.
- **Upload Button:** Manual file upload fallback.
- **AI Processing Overlay:** Displays a loading state while Gemini API parses the garment image to extract Colors, Fabrics, Fits, and DNA.

### 3. Gallery (`Gallery.tsx`)
**Purpose:** The central repository for all clothing and outfit combinations. Functions like a native Photos app.
**Key Elements:**
- **"+ NEW" Button:** Triggers manual upload/addition flow.
- **Search Bar:** Real-time text filtering against titles, occasions, colors, and notes.
- **Pill Navigation (Horizontal Scrollable Chips):**
  - Modern, scrollbar-free swipeable tabs (All, Favorites, Folders/Collections).
  - Automatically filters the grid below.
- **Photo Grid:** 2-column or 3-column responsive masonry/grid layout containing the actual images. Displays broken-image fallback placeholders if files are missing.

#### 3a. Gallery Image Details (Outfit Card)
**Purpose:** The "Fashion Card" view expanded when an image in the Gallery is tapped.
**Key Elements:**
- **Back Button (✕):** Top-left absolute overlay over the image to return to the grid.
- **Image Container:** Scales optimally via `object-contain` without aggressive cropping.
- **Favorite Button (❤️):** Toggles favorite status.
- **Metadata Title:** Displays item name, upload date, and source (e.g., Google Flow).
- **Essential Info List:** Clean, padded key-value list showing: Occasion, Season, Style, Primary Colors, Secondary Colors, Fabric, Fit.
- **DNA Block:** Expanding text area detailing the AI-extracted stylistic DNA.
- **Notes Block:** User annotations.

### 4. Settings (`SettingsScreen.tsx`)
**Purpose:** Application configuration and Brain health monitoring.
**Key Elements:**
- **Profile / Identity:** User settings (Name, Style Philosophy, Body Type).
- **AYA BRAIN Panel:** A dashboard displaying holistic analytics instead of database terms:
  - Total Wardrobe items
  - Gallery size
  - Extracted Colors
  - Extracted Fabrics
  - Total Rules generated
- **System Actions:** Buttons to Export Data, Backup Database, and clear cache.

## Backend Architecture
- **Server:** Express.js (`server.ts`)
- **Database:** SQLite WASM (`sql.js`) persisting locally to `data/aya.db`.
- **Static Assets:** 
  - Served via Express static paths. 
  - User images are kept exclusively locally under `data/images/` and do not sync to Git.
- **AI Integration:** Google Gemini API integration configured via environment variables or DB settings, utilized in ingestion pipelines to parse images and build the "Brain."
