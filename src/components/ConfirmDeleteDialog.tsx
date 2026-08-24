import { useMapStore } from '../store/mapStore';

export function ConfirmDeleteDialog() {
  const pendingDeleteId = useMapStore((s) => s.pendingDeleteId);
  const node = useMapStore((s) => (s.pendingDeleteId ? s.nodes[s.pendingDeleteId] : undefined));
  const descendantCount = useMapStore((s) =>
    s.pendingDeleteId ? s.countDescendants(s.pendingDeleteId) : 0,
  );
  const cancelDelete = useMapStore((s) => s.cancelDelete);
  const confirmDelete = useMapStore((s) => s.confirmDelete);

  if (!pendingDeleteId || !node) return null;

  return (
    <div className="modal-overlay" onClick={cancelDelete}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>מחיקת "{node.text}"</h2>
        <p>
          {descendantCount > 0
            ? `הפעולה תמחק גם את ${descendantCount} תתי-הענפים שנמצאים תחתיו. לא ניתן לבטל פעולה זו.`
            : 'לא ניתן לבטל פעולה זו.'}
        </p>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={cancelDelete}>
            ביטול
          </button>
          <button type="button" className="btn-danger" onClick={confirmDelete}>
            מחק
          </button>
        </div>
      </div>
    </div>
  );
}
