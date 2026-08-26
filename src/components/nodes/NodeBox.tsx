import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { useMapStore } from '../../store/mapStore';
import { useNodeSizeReporter } from '../../layout/nodeSizing';
import { getInheritedBranchColor } from '../../layout/branchColor';
import { useIsExportMode } from '../../export/exportMode';

interface NodeBoxProps {
  id: string;
  isRoot?: boolean;
}

export function NodeBox({ id, isRoot = false }: NodeBoxProps) {
  const node = useMapStore((s) => s.nodes[id]);
  const size = useMapStore((s) => s.sizes[id]);
  const rootId = useMapStore((s) => s.rootId);
  const photoUrl = useMapStore((s) => s.photoUrl);
  const branchColor = useMapStore((s) => getInheritedBranchColor(s.nodes, s.rootId, id));
  const renameNode = useMapStore((s) => s.renameNode);
  const toggleAchieved = useMapStore((s) => s.toggleAchieved);
  const toggleHighlight = useMapStore((s) => s.toggleHighlight);
  const addChild = useMapStore((s) => s.addChild);
  const addMainBranch = useMapStore((s) => s.addMainBranch);
  const requestDelete = useMapStore((s) => s.requestDelete);
  const setNodeSize = useMapStore((s) => s.setNodeSize);
  const editRequestId = useMapStore((s) => s.editRequestId);
  const clearEditRequest = useMapStore((s) => s.clearEditRequest);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(node?.text ?? '');
  const boxRef = useRef<HTMLDivElement>(null);
  const isExport = useIsExportMode();

  useNodeSizeReporter(boxRef, size, (next) => setNodeSize(id, next), !editing);

  // A just-created node opens straight into editing with an empty draft, so
  // the user types its real name immediately instead of first having to
  // clear a placeholder like "נושא חדש".
  useEffect(() => {
    if (editRequestId !== id) return;
    setDraft('');
    setEditing(true);
    clearEditRequest();
  }, [editRequestId, id, clearEditRequest]);

  if (!node) return null;

  const isLevel1 = node.parentId === rootId;
  const isDeep = !isRoot && !isLevel1;

  function startEdit() {
    if (isExport) return;
    setDraft(node.text);
    setEditing(true);
  }

  function commitEdit() {
    setEditing(false);
    renameNode(id, draft);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') {
      setDraft(node.text);
      setEditing(false);
    }
  }

  function onAdd() {
    if (isRoot) addMainBranch();
    else addChild(id);
  }

  return (
    <div className="mm-node" ref={boxRef}>
      <div
        className={
          'mm-node-box' +
          (isRoot ? ' root' : '') +
          (isLevel1 ? ' level-1' : '') +
          (isDeep ? ' leaf' : '') +
          (node.achieved ? ' achieved' : '') +
          (node.highlighted ? ' highlighted' : '')
        }
        style={isRoot ? undefined : ({ '--branch-color': branchColor } as CSSProperties)}
        onDoubleClick={startEdit}
      >
        {isRoot && photoUrl && <img className="mm-root-avatar" src={photoUrl} alt="" />}

        {!isRoot && (
          <button
            type="button"
            className={'mm-achieved-toggle nodrag' + (node.achieved ? ' checked' : '')}
            title={node.achieved ? 'סמן כלא הושג' : 'סמן כהושג'}
            onClick={() => toggleAchieved(id)}
          >
            <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
              <path
                d="M3 8.5L6.2 11.5L13 4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}

        {editing ? (
          <input
            className="mm-node-input nodrag"
            autoFocus
            value={draft}
            placeholder="הקלידו כאן..."
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={onKeyDown}
            style={{ width: `${Math.max(draft.length || 10, 4)}ch` }}
          />
        ) : (
          <span className="mm-node-text" onClick={startEdit}>
            {node.text}
          </span>
        )}

        {/* Part of the bubble's own content row (never absolutely positioned
            outside it), so these can never be clipped by React Flow's
            overflow:hidden viewport wrapper near a canvas edge — and they
            work identically for mouse and touch since nothing depends on
            hover. Kept in the export snapshot too (just made invisible,
            never unmounted) so the box keeps the exact width it was
            measured at live — dropping them outright would leave the
            printed/saved node narrower than its forced width, showing up
            as unexplained slack/centering that doesn't match the screen. */}
        <span className={'mm-node-inline-actions' + (isExport ? ' mm-invisible' : '')}>
          <button
            type="button"
            className={'mm-node-action-btn highlight nodrag' + (node.highlighted ? ' active' : '')}
            title={node.highlighted ? 'הסר הדגשה' : 'הדגש ענף'}
            onClick={() => toggleHighlight(id)}
          >
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
              <path
                d="M8 1.6l1.85 3.92 4.32.58-3.15 2.98.78 4.32L8 11.35l-3.8 2.05.78-4.32-3.15-2.98 4.32-.58L8 1.6z"
                fill="currentColor"
              />
            </svg>
          </button>
          <button type="button" className="mm-node-action-btn add nodrag" title="הוסף ענף" onClick={onAdd}>
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
              <path d="M8 2.5v11M2.5 8h11" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
          {!isRoot && (
            <button
              type="button"
              className="mm-node-action-btn delete nodrag"
              title="מחק ענף"
              onClick={() => requestDelete(id)}
            >
              <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                <path
                  d="M3.2 3.2l9.6 9.6M12.8 3.2l-9.6 9.6"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
        </span>
      </div>
    </div>
  );
}
