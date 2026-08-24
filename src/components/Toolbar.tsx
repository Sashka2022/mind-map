import { useEffect, useState } from 'react';
import { useMapStore } from '../store/mapStore';

interface ToolbarProps {
  onOpenPrint: () => void;
}

export function Toolbar({ onOpenPrint }: ToolbarProps) {
  const title = useMapStore((s) => s.title);
  const saveNow = useMapStore((s) => s.saveNow);
  const lastSavedAt = useMapStore((s) => s.lastSavedAt);
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (lastSavedAt === null) return;
    setShowSaved(true);
    const timer = setTimeout(() => setShowSaved(false), 2000);
    return () => clearTimeout(timer);
  }, [lastSavedAt]);

  return (
    <div className="toolbar">
      <span className="toolbar-title">{title}</span>
      {showSaved && <span className="saved-flash">נשמר ✓</span>}
      <button type="button" onClick={saveNow}>
        שמור מפה
      </button>
      <button type="button" onClick={onOpenPrint}>
        הדפסה / PDF
      </button>
    </div>
  );
}
