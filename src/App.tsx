import { useState } from 'react';
import { useMapStore } from './store/mapStore';
import { Onboarding } from './components/Onboarding';
import { Toolbar } from './components/Toolbar';
import { MindMapCanvas } from './components/MindMapCanvas';
import { SidePhotoPanel } from './components/SidePhotoPanel';
import { ConfirmDeleteDialog } from './components/ConfirmDeleteDialog';
import { ConfirmResetDialog } from './components/ConfirmResetDialog';
import { PrintPreviewModal } from './components/PrintPreviewModal';

function App() {
  const hasHydrated = useMapStore((s) => s.hasHydrated);
  const initialized = useMapStore((s) => s.initialized);
  const [printOpen, setPrintOpen] = useState(false);

  // Wait for the persisted map to load from localStorage before deciding
  // whether to show onboarding — otherwise every reload briefly shows
  // onboarding first, and submitting it during that flash overwrites the
  // saved map with a blank one.
  if (!hasHydrated) return null;
  if (!initialized) return <Onboarding />;

  return (
    <div className="app">
      <Toolbar onOpenPrint={() => setPrintOpen(true)} />
      <SidePhotoPanel />
      <MindMapCanvas />
      <ConfirmDeleteDialog />
      <ConfirmResetDialog />
      {printOpen && <PrintPreviewModal onClose={() => setPrintOpen(false)} />}
    </div>
  );
}

export default App;
