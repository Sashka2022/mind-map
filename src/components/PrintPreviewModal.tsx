import { useEffect, useMemo, useRef, useState } from 'react';
import { getNodesBounds } from '@xyflow/react';
import { useMapStore } from '../store/mapStore';
import { buildFlowGraph } from '../flowGraph';
import { symmetrizeBounds } from '../layout/bounds';
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

  // Symmetric around the root (not just the raw content box) so the trunk
  // stays visually centered even when one branch outgrows its opposite.
  const bounds = useMemo(() => {
    const raw = getNodesBounds(flowNodes);
    const rootCenter = positions[rootId];
    return rootCenter ? symmetrizeBounds(raw, rootCenter) : raw;
  }, [flowNodes, positions, rootId]);
  const autoRecommendation = useMemo(() => chooseAutoPage(bounds), [bounds]);

  const [paper, setPaper] = useState<PaperSize>(autoRecommendation.paper);
  const [orientation, setOrientation] = useState<Orientation>(autoRecommendation.orientation);
  const [isAuto, setIsAuto] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'preview' | 'print' | 'pdf' | 'whatsapp' | null>(null);
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
        const snapshot = await renderMapSnapshot(flowNodes, flowEdges, { paper, orientation }, 90, bounds);
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
  }, [paper, orientation, flowNodes, flowEdges, bounds, previewNonce]);

  async function handlePrint() {
    setBusy('print');
    setActionError(null);
    try {
      await printMap(flowNodes, flowEdges, { paper, orientation }, bounds);
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
      await exportToPdf(flowNodes, flowEdges, { paper, orientation }, `${title || 'מפת-חשיבה'}.pdf`, bounds);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'שגיאה בייצוא ה-PDF');
    } finally {
      setBusy(null);
    }
  }

  async function handleShareWhatsapp() {
    if (!previewUrl) return;
    setBusy('whatsapp');
    setActionError(null);
    try {
      const fileName = `${title || 'מפת-חשיבה'}.jpg`;
      // The on-screen preview is rendered at a low DPI to stay fast while
      // the user is still picking paper size/orientation — sharing that
      // directly produced a blurry, low-quality image. Re-render at the
      // same DPI used for print/PDF so the shared file is full quality.
      const shareSnapshot = await renderMapSnapshot(flowNodes, flowEdges, { paper, orientation }, 180, bounds);
      const blob = await (await fetch(shareSnapshot.dataUrl)).blob();
      const file = new File([blob], fileName, { type: 'image/jpeg' });

      // Web Share API with a file attachment — on a phone this opens the
      // native share sheet with WhatsApp as one of the targets, image
      // already attached. Not supported for files on most desktop browsers.
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: title || 'מפת חשיבה' });
        return;
      }

      // Fallback: WhatsApp's web/app link only accepts prefilled text, not
      // a file, so download the image and open a chat with a note to attach
      // it manually. A `data:` URL's `download` filename is unreliable
      // across browsers (often falls back to a generic "download"); an
      // object URL for the same blob honors it consistently.
      const objectUrl = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      const message = encodeURIComponent(`${title || 'מפת חשיבה'} — מצורפת התמונה שהורדה כעת`);
      window.open(`https://wa.me/?text=${message}`, '_blank', 'noopener,noreferrer');
      setActionError('הדפדפן הזה לא תומך בצירוף קובץ אוטומטית — התמונה הורדה, צרפו אותה ידנית בוואטסאפ.');
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return; // user closed the share sheet
      setActionError(err instanceof Error ? err.message : 'שגיאה בשיתוף לוואטסאפ');
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
          <button
            type="button"
            className="btn-whatsapp"
            disabled={!!busy || !previewUrl}
            onClick={handleShareWhatsapp}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path
                fill="currentColor"
                d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.48-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.6-.91-2.2-.24-.58-.49-.5-.67-.5-.17-.01-.37-.01-.57-.01-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.47 0 1.46 1.06 2.87 1.21 3.07.15.2 2.08 3.17 5.03 4.44.7.3 1.25.48 1.68.62.7.22 1.34.19 1.85.12.56-.08 1.76-.72 2-1.42.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35z"
              />
              <path
                fill="currentColor"
                d="M12.02 2C6.5 2 2.03 6.48 2.03 12c0 1.85.5 3.58 1.36 5.07L2 22l5.08-1.33A9.94 9.94 0 0 0 12.02 22C17.53 22 22 17.52 22 12S17.53 2 12.02 2zm0 18.1c-1.66 0-3.2-.48-4.5-1.32l-.32-.2-3.02.79.8-2.94-.21-.31A8.09 8.09 0 0 1 3.93 12c0-4.47 3.63-8.1 8.09-8.1 4.46 0 8.08 3.63 8.08 8.1 0 4.47-3.62 8.1-8.08 8.1z"
              />
            </svg>
            {busy === 'whatsapp' ? 'שולח...' : 'שליחה לוואטסאפ'}
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
