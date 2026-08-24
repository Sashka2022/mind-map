import { useMapStore } from '../store/mapStore';

export function ConfirmResetDialog() {
  const pendingReset = useMapStore((s) => s.pendingReset);
  const cancelReset = useMapStore((s) => s.cancelReset);
  const confirmReset = useMapStore((s) => s.confirmReset);

  if (!pendingReset) return null;

  return (
    <div className="modal-overlay" onClick={cancelReset}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>איפוס המפה</h2>
        <p>הפעולה תמחק את כל המפה הנוכחית ותחזיר אתכם למסך הפתיחה. לא ניתן לבטל פעולה זו.</p>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={cancelReset}>
            ביטול
          </button>
          <button type="button" className="btn-danger" onClick={confirmReset}>
            אפס מפה
          </button>
        </div>
      </div>
    </div>
  );
}
