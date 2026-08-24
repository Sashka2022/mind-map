import { useState } from 'react';
import { useMapStore } from './store/mapStore';
import { Onboarding } from './components/Onboarding';
import { Toolbar } from './components/Toolbar';
import { MindMapCanvas } from './components/MindMapCanvas';
import { ConfirmDeleteDialog } from './components/ConfirmDeleteDialog';
import { ConfirmResetDialog } from './components/ConfirmResetDialog';
import { PrintPreviewModal } from './components/PrintPreviewModal';

function App() {
  const initialized = useMapStore((s) => s.initialized);
  const [printOpen, setPrintOpen] = useState(false);

  if (!initialized) return <Onboarding />;

  return (
    <div className="app">
      <Toolbar onOpenPrint={() => setPrintOpen(true)} />
      <MindMapCanvas />
      <ConfirmDeleteDialog />
      <ConfirmResetDialog />
      {printOpen && <PrintPreviewModal onClose={() => setPrintOpen(false)} />}
    </div>
  );
}

export default App;
