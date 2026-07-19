import { useEffect, useState } from "react";
import { Btn, Field, ScreenHeader } from "@/components/ui-bits";
import { useStore } from "@/lib/store";

export function SettingsScreen() {
  const { status, darkMode, setDarkMode, runBackup, loading } = useStore();
  const [backupResult, setBackupResult] = useState<string | null>(null);

  const [apiKey, setApiKey] = useState("");
  const [keySavedMessage, setKeySavedMessage] = useState<string | null>(null);

  // Fetch settings from API on load
  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.gemini_api_key) setApiKey(data.gemini_api_key);
      })
      .catch(console.error);
  }, []);

  const saveApiKey = async () => {
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gemini_api_key: apiKey }),
      });
      setKeySavedMessage("API Key saved to SQLite Settings database.");
      setTimeout(() => setKeySavedMessage(null), 3000);
    } catch (e) {
      setKeySavedMessage("Error saving API key.");
    }
  };

  const handleBackup = async () => {
    try {
      const result = await runBackup();
      setBackupResult(`Backup saved: ${result.filename}`);
      // Trigger download
      window.location.href = `/api/backup/download/${result.filename}`;
    } catch (e) {
      setBackupResult(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
    }
  };

  const exportWardrobe = () => {
    window.location.href = "/api/export";
  };

  const counts = status?.counts;

  return (
    <div className="screen-pad space-y-6">
      <ScreenHeader title="Settings" subtitle="AYA OS v1.0 Configuration" />

      {/* Database stats */}
      {counts && (
        <section>
          <div className="mono-label mb-2">AYA BRAIN</div>
          <div className="surface divide-hair overflow-hidden">
            {[
              ["Wardrobe", counts.garments],
              ["Knowledge", counts.rules],
              ["Gallery", counts.gallery],
              ["Research", counts.research],
              ["Colors", counts.colors],
              ["Fabrics", counts.fabrics],
              ["Outfits", counts.outfits],
              ["Brain Health", "98%"],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex items-center justify-between p-3">
                <span className="text-xs">{label}</span>
                <span className="font-data text-sm font-semibold" data-numeric="true">{value}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* API Key Configuration */}
      <section>
        <div className="mono-label mb-2">API Configuration</div>
        <div className="surface p-3 space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Configure your API Key. AYA OS will check here first, then fall back to the <code>API_KEY</code> environment variable if this is empty.
          </p>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="API Key"
            className="w-full rounded-xl border border-border bg-card px-3 py-3 text-sm outline-none"
          />
          {keySavedMessage && (
            <div className="text-[11px] text-green-400 font-medium">
              {keySavedMessage}
            </div>
          )}
          <Btn onClick={saveApiKey}>Save API Key</Btn>
        </div>
      </section>



      {/* Backup */}
      <section>
        <div className="mono-label mb-2">Database Backup</div>
        <div className="surface p-3 space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            AYA's SQLite database is a single file. Create a backup and download it for safekeeping.
          </p>
          {backupResult && (
            <div className={`text-xs ${backupResult.startsWith("Error") ? "text-red-400" : "text-green-400"}`}>
              {backupResult}
            </div>
          )}
          <Btn variant="secondary" onClick={handleBackup} disabled={loading["backup"]}>
            {loading["backup"] ? "Creating backup..." : "Backup & Download Database"}
          </Btn>
        </div>
      </section>

      {/* Export */}
      <section>
        <div className="mono-label mb-2">Export Wardrobe</div>
        <div className="surface p-3 space-y-3">
          <p className="text-xs text-muted-foreground">Export full wardrobe as structured JSON.</p>
          <Btn variant="secondary" onClick={exportWardrobe}>Export Wardrobe JSON</Btn>
        </div>
      </section>

      {/* UI Settings */}
      <section>
        <div className="mono-label mb-2">Interface</div>
        <div className="surface divide-hair overflow-hidden">
          <div className="flex items-center justify-between p-3">
            <span className="text-xs">Dark Mode</span>
            <Btn
              variant={darkMode ? "primary" : "secondary"}
              onClick={() => setDarkMode(!darkMode)}
              className="w-auto px-4 py-2 text-xs"
            >
              {darkMode ? "On" : "Off"}
            </Btn>
          </div>
        </div>
      </section>

      <p className="text-center text-[10px] text-muted-foreground">
        AYA Fashion Intelligence OS v1.0 • SQLite • AI Vision
      </p>
    </div>
  );
}
