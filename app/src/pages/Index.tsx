import { BottomNav, SidebarNav } from "@/components/ui-bits";
import { StoreProvider, useStore } from "@/lib/store";
import { CaptureScreen } from "@/screens/Capture";
import { Home } from "@/screens/Home";
import { GalleryScreen } from "@/screens/Gallery";
import { SettingsScreen } from "@/screens/SettingsScreen";
import { OutfitGeneratorScreen } from "@/screens/OutfitGenerator";
import { ActivityScreen } from "@/screens/ActivityScreen";

function Router() {
  const { screen } = useStore();
  switch (screen.name) {
    case "home":               return <Home />;
    case "capture":            return <CaptureScreen />;
    case "gallery":            return <GalleryScreen />;
    case "outfit":             return <OutfitGeneratorScreen />;
    case "activity":           return <ActivityScreen />;
    case "settings":           return <SettingsScreen />;
    default:                   return <Home />;
  }
}

const Index = () => (
  <StoreProvider>
    <div className="min-h-[100dvh] bg-muted/30">
      <div className="app-shell flex w-full">
        <SidebarNav />
        <main className="flex-1 min-w-0">
          <Router />
        </main>
        <BottomNav />
      </div>
    </div>
  </StoreProvider>
);

export default Index;
