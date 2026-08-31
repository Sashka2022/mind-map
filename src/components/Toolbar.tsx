import { useEffect, useState } from 'react';
import { useMapStore } from '../store/mapStore';
import hotamLogo from '../assets/hotam-logo.png';

interface ToolbarProps {
  onOpenPrint: () => void;
}

function SaveIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <path
        d="M4 3.5h9.5L16 6v10a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 4 16V3.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M6.5 3.5V7.5h6V3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M6.5 16v-4.5h6V16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <path
        d="M5.5 7V3.5h9V7M5.5 14h9v3h-9v-3zM3 7h14v6H3V7z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <path
        d="M15.5 10a5.5 5.5 0 1 1-1.7-3.98M15.5 4v3.5H12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Toolbar({ onOpenPrint }: ToolbarProps) {
  const title = useMapStore((s) => s.title);
  const saveNow = useMapStore((s) => s.saveNow);
  const lastSavedAt = useMapStore((s) => s.lastSavedAt);
  const requestReset = useMapStore((s) => s.requestReset);
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (lastSavedAt === null) return;
    setShowSaved(true);
    const timer = setTimeout(() => setShowSaved(false), 2000);
    return () => clearTimeout(timer);
  }, [lastSavedAt]);

  return (
    <div className="toolbar">
      <img className="toolbar-logo" src={hotamLogo} alt="חותם" />
      <span className="toolbar-title">{title}</span>
      {showSaved && <span className="saved-flash">נשמר ✓</span>}
      <button type="button" className="toolbar-btn primary" onClick={saveNow}>
        <SaveIcon />
        שמור מפה
      </button>
      <button type="button" className="toolbar-btn" onClick={onOpenPrint}>
        <PrintIcon />
        הדפסה / PDF
      </button>
      <button type="button" className="toolbar-btn danger" onClick={requestReset}>
        <ResetIcon />
        איפוס מפה
      </button>
    </div>
  );
}
