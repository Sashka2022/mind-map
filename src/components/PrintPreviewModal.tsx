import { useEffect, useMemo, useRef, useState } from 'react';
import { getNodesBounds } from '@xyflow/react';
import { useMapStore } from '../store/mapStore';
import { buildFlowGraph } from '../flowGraph';
import { renderMapSnapshot } from '../export/snapshot';
import { printMap } from '../export/printMap';
import { exportToPdf } from '../export/exportToPdf';
import { chooseAutoPage, computeFitScale, MIN_READABLE_SCALE, type Orientation, type PaperSize } from '../export/computeFitScale';

interface PrintPreviewModalProps {
  onClose: () => void;
}

export function PrintPreviewModal({ onClose }: PrintPreviewModalProps) {
  const nodes = useMapStore((s) => s.nodes);
  const rootId = useMapStore((s) => s.rootId);
  const sizes = useMapStore((s) => s.sizes);
  const positions = useMapStore((s) => s.positions);
  const title = useMapStore((s) => s.title);

  const { flowNodes, flowEdges } = useMemo(
    () => buildFlowGraph(nodes, rootId, sizes, positions, { forceSize: true }),
    [nodes, rootId, sizes, positions],
  );

  const bounds = useMemo(() => getNodesBounds(flowNodes), [flowNodes]);
  const autoRecommendation = useMemo(() => chooseAutoPage(bounds), [bounds]);

  const [paper, setPaper] = useState<PaperSize>(autoRecommendation.paper);
  const [orientation, setOrientation] = useState<Orientation>(autoRecommendation.orientation);
  const [isAuto, setIsAuto] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'preview' | 'print' | 'pdf' | null>(null);
  const requestId = useRef(0);
  const [previewNonce, setPreviewNonce] = useState(0);

  // While in auto mode, track the map as it grows/shrinks so the page
  // size/orientation keeps matching — e.g. adding enough branches to blow
  // past A4's readable limit bumps it up to A3 automatically.
  useEffect(() => {
    if (!isAuto) return;
    setPaper(autoRecommendation.paper);
    setOrientation(autoRecommendation.orientation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuto, autoRecommendation.paper, autoRecommendation.orientation]);

  function selectAuto() {
    setIsAuto(true);
  }

  function selectPaper(next: PaperSize) {
    setIsAuto(false);
    setPaper(next);
  }

  function selectOrientation(next: Orientation) {
    setIsAuto(false);
    setOrientation(next);
  }

  const currentFit = useMemo(() => computeFitScale(bounds, { paper, orientation }), [bounds, paper, orientation]);
  const isCramped = currentFit.scale < MIN_READABLE_SCALE;

  useEffect(() => {
    const myRequest = ++requestId.current;
    setBusy('preview');
    setPreviewError(null);
    const timer = setTimeout(async () => {
      try {
        const snapshot = await renderMapSnapshot(flowNodes, flowEdges, { paper, orientation }, 90);
        if (requestId.current === myRequest) {
          setPreviewUrl(snapshot.dataUrl);
        }
      } catch (err) {
        if (requestId.current === myRequest) {
          setPreviewUrl(null);
          setPreviewError(err instanceof Error ? err.message : 'שגיאה ביצירת התצוגה המקדימה');
        }
      } finally {
        if (requestId.current === myRequest) setBusy(null);
      }
    }, 150);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paper, orientation, flowNodes, flowEdges, previewNonce]);

  async function handlePrint() {
    setBusy('print');
    setActionError(null);
    try {
      await printMap(flowNodes, flowEdges, { paper, orientation });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'שגיאה בהכנת ההדפסה');
    } finally {
      setBusy(null);
    }
  }

  async function handleDownloadPdf() {
    setBusy('pdf');
    setActionError(null);
    try {
      await exportToPdf(flowNodes, flowEdges, { paper, orientation }, `${title || 'מפת-חשיבה'}.pdf`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'שגיאה בייצוא ה-PDF');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card print-modal" onClick={(e) => e.stopPropagation()}>
        <h2>הדפסה / ייצוא ל-PDF</h2>

        <div className="print-options">
          <fieldset className="print-option-group">
            <legend>גודל נייר</legend>
            <label>
              <input
                type="radio"
                name="paper"
                checked={paper === 'A4'}
                onChange={() => selectPaper('A4')}
              />
              A4
            </label>
            <label>
              <input
                type="radio"
                name="paper"
                checked={paper === 'A3'}
                onChange={() => selectPaper('A3')}
              />
              A3
            </label>
          </fieldset>

          <fieldset className="print-option-group">
            <legend>כיוון</legend>
            <label>
              <input
                type="radio"
                name="orientation"
                checked={orientation === 'landscape'}
                onChange={() => selectOrientation('landscape')}
              />
              לרוחב
            </label>
            <label>
              <input
                type="radio"
                name="orientation"
                checked={orientation === 'portrait'}
                onChange={() => selectOrientation('portrait')}
              />
              לאורך
            </label>
          </fieldset>
        </div>

        <p className="print-auto-note">
          {isAuto ? (
            <>גודל הנייר והכיוון נבחרים אוטומטית כדי שהמפה תיראה קריאה ומאוזנת.</>
          ) : (
            <>
              בחירה ידנית.{' '}
              <button type="button" className="print-auto-link" onClick={selectAuto}>
                חזרה לבחירה אוטומטית
              </button>
            </>
          )}
        </p>
        {isCramped && (
          <p className="print-cramped-warning">
            המפה מכילה הרבה תוכן — גם בנייר A3 חלק מהטקסט יודפס קטן. שקלו לפצל אותה למספר מפות קטנות יותר.
          </p>
        )}

        <div className="print-preview-frame">
          {previewError ? (
            <div className="print-preview-error">
              <span>לא ניתן היה ליצור תצוגה מקדימה: {previewError}</span>
              <button type="button" className="btn-secondary" onClick={() => setPreviewNonce((n) => n + 1)}>
                נסה שוב
              </button>
            </div>
          ) : previewUrl ? (
            <img src={previewUrl} alt="תצוגה מקדימה של מפת החשיבה" />
          ) : (
            <span className="print-preview-loading">טוען תצוגה מקדימה...</span>
          )}
        </div>

        {actionError && <p className="print-action-error">{actionError}</p>}

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            ביטול
          </button>
          <button type="button" className="btn-secondary" disabled={!!busy} onClick={handleDownloadPdf}>
            {busy === 'pdf' ? 'מייצא...' : 'הורד PDF'}
          </button>
          <button type="button" className="btn-primary" disabled={!!busy} onClick={handlePrint}>
            {busy === 'print' ? 'מכין להדפסה...' : 'הדפס'}
          </button>
        </div>
      </div>
    </div>
  );
}
