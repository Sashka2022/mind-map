import { useEffect, useRef, useState } from 'react';
import { videoFrameToResizedDataUrl } from '../utils/resizeImage';

interface CameraCaptureModalProps {
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
}

export function CameraCaptureModal({ onCapture, onClose }: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setReady(true);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? 'לא ניתן היה לגשת למצלמה: ' + err.message : 'לא ניתן היה לגשת למצלמה');
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  function handleCapture() {
    const video = videoRef.current;
    if (!video) return;
    try {
      onCapture(videoFrameToResizedDataUrl(video));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'לא ניתן היה לצלם תמונה');
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card camera-modal" onClick={(e) => e.stopPropagation()}>
        <h2>צילום סלפי</h2>
        {error ? (
          <p className="onboarding-photo-error">{error}</p>
        ) : (
          <div className="camera-preview-frame">
            <video ref={videoRef} autoPlay playsInline muted />
            {!ready && <span className="print-preview-loading">מפעיל מצלמה...</span>}
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            ביטול
          </button>
          <button type="button" className="btn-primary" disabled={!ready || !!error} onClick={handleCapture}>
            צלם
          </button>
        </div>
      </div>
    </div>
  );
}
