# מפת חשיבה (mind-map)

React + TypeScript personal mind-mapping app, RTL/Hebrew UI. Built on
`@xyflow/react` (React Flow v12) for canvas rendering, with a fully custom
tree-layout algorithm (not React Flow's own auto-layout) feeding it
positions each render.

- Live site: **https://sashka2022.github.io/mind-map/** (GitHub Pages,
  deployed automatically by `.github/workflows/deploy.yml` on every push to
  `master`, base path `/mind-map/`).
- Dev: `npm run dev` (Vite). Build: `npm run build` (`tsc -b && vite build`).
  Lint: `npm run lint` (oxlint).
- No test suite exists in this repo — verification is build + lint +
  manual/Playwright browser checks.

## Architecture map

```
src/
  types.ts                  MapNode, Direction, BRANCH_COLORS palette
  flowGraph.ts               builds React Flow nodes/edges from the tree
  store/mapStore.ts          zustand store (persisted to localStorage),
                              all mutations (add/rename/delete/highlight/...)
  layout/
    treeLayout.ts             the actual layout algorithm (positions)
    directions.ts             getInheritedDirection (walks to level-1 ancestor)
    branchColor.ts            getInheritedBranchColor (same pattern, for color)
    nodeSizing.ts              ResizeObserver-based live size measurement
    bounds.ts                  symmetrizeBounds (keep root centered)
  components/
    MindMapCanvas.tsx          wraps <ReactFlow>, pan/zoom/recenter/drag
    Toolbar.tsx                 save / print-PDF / reset buttons + Hotam logo
    Onboarding.tsx               first-run: map title + optional photo + Hotam logo
    CameraCaptureModal.tsx       getUserMedia live camera modal for the selfie button
    SidePhotoPanel.tsx           persistent corner panel mirroring root photo
    PrintPreviewModal.tsx        print/PDF modal + WhatsApp share button
    nodeTypes.ts / nodes/RootNode.tsx / nodes/BranchNode.tsx / nodes/NodeBox.tsx
                                  NodeBox is the ONE shared component that
                                  renders all node chrome (root/level-1/leaf
                                  are CSS-class variants of the same component)
  assets/
    hotam-logo.png               official Hotam logo (Hebrew wordmark + spark),
                                  imported wherever the app is branded — see
                                  "Hotam branding" below for every place it's used
  export/
    snapshot.tsx                renderMapSnapshot(): the shared rasterizer
                                  used by print, PDF export, the preview
                                  thumbnail, and WhatsApp sharing alike
    printMap.ts / exportToPdf.ts / computeFitScale.ts / ExportFlow.tsx
```

Node tiers (all render through `NodeBox.tsx`, distinguished by CSS class):
- **root**: gradient pill, has the onboarding photo avatar.
- **level-1** (`node.parentId === rootId`, i.e. main branches): organic
  single-blob "cloud" shape (`border-radius` asymmetric percentages — see
  Gotchas below for why it's NOT two overlapping pseudo-elements).
- **leaf** (`isDeep`, depth ≥ 2): no box at all — plain colored text sitting
  on the connecting line, still editable in place (click/dblclick → input).

Color system: `types.ts` exports `BRANCH_COLORS` (8-color palette).
`layout/branchColor.ts`'s `getInheritedBranchColor(nodes, rootId, id)` walks
up to the node's level-1 ancestor and returns a color keyed by that
ancestor's **index among the root's children** (not by layout direction —
direction is still used only for the 4-way `up/down/left/right` positioning
and the root's own gradient). Every node applies its branch color via a
`--branch-color` CSS custom property set inline in `NodeBox.tsx`; edges get
the same color via `flowGraph.ts`'s `computeBranchColor`-equivalent call to
the same helper. So a whole branch — cloud, leaves, and connecting lines —
reads as one consistent color from root to tip.

Highlight: single boolean `node.highlighted` (was a 3-color yellow/red/pink
`highlightColor` picker before this session — see below). A star button
toggles it; highlighted nodes render in their own branch color (no separate
fixed palette). `mapStore.ts` has `migrateLegacyHighlights()` to convert any
old persisted `highlightColor` data on load.

## Development history (multiple Claude Code sessions)

**PR #1** — six requested UI/UX improvements:
1. Cloud shapes for main branches (originally two overlapping pseudo-element
   "puffs" — see Gotcha below, later replaced).
2. Sub-branches (leaf) write directly on the connecting line, no box.
3. Distinct color per main branch, inherited by all descendants + edges
   (see Color system above).
4. Clearer toolbar (icons, primary/secondary/danger styling) and per-node
   buttons (always-visible faint circle instead of hover-only).
5. `SidePhotoPanel.tsx`: persistent corner panel mirroring the root photo.
6. Single highlight star toggle replacing the 3-color dot picker.

**PR #2** — bug fix reported by the user: the two-puff cloud shape looked
like disconnected floating balloons (each pseudo-element drew its own
border, and the borders crossed the pill's border with a visible seam).
Fixed by switching to **one element** with an asymmetric `border-radius`
blob (`40% 60% 57% 43% / 62% 48% 52% 38%`) — a single continuous outline by
construction, no seam possible. **Prefer this pattern over layered
pseudo-elements for any future "organic shape" styling in this app.**

**PR #3** — user reported print/save didn't match the live map, plus asked
for a WhatsApp share button:
- Fixed print/PDF/preview missing all connecting lines entirely — see the
  detailed Gotcha below, this was a **pre-existing bug** (verified against
  the pre-session commit), not caused by PR #1/#2.
  changed the two conditionally-`{!isExport && ...}` blocks in `NodeBox.tsx`
  to always render but use a `.mm-invisible { visibility: hidden; }` class
  in export mode, so the box keeps the exact width/spacing it had live.
- Added "שליחה לוואטסאפ" button in `PrintPreviewModal.tsx`: Web Share API
  with the rendered image as a `File` attachment when
  `navigator.canShare({files:[file]})` (mobile share sheet), falling back to
  downloading the image (via a `Blob`/object URL — see Gotcha) + opening a
  `wa.me` chat link with prefilled text on desktop.

**PR #4** — added this `CLAUDE.md` file (no code change).

**PR #5** (2026-08-28, separate session) — user reported two mobile issues:
1. The canvas auto-recentered/re-fit on *every* layout change (including
   adding a branch), silently overriding any zoom/pan the user had set
   manually — most disruptive on mobile, where zooming into one branch is
   the normal way to work. Fixed in `MindMapCanvas.tsx` by tracking a
   `userInteractedRef` flag: once React Flow's `onMoveStart` fires with a
   genuine user-driven event, `scheduleRecenter()` stops auto-fitting until
   the map itself is replaced (rootId changes) or the container really
   resizes (`scheduleRecenter(true)` forces it).
2. WhatsApp shares were blurry and sometimes missing connecting lines on
   phones: `handleShareWhatsapp` was reusing the *low-DPI on-screen preview*
   image instead of re-rendering at full quality, and the fixed settle
   delays in `snapshot.tsx` (tuned on a fast desktop) were too short for
   slower mobile hardware to reliably finish painting the nested edges
   `<svg>` before capture (same underlying race as Gotcha #1 below, just
   needing a bigger margin on slow devices). Fixed by re-rendering via
   `renderMapSnapshot` at DPI 180 for sharing (same as print/PDF) instead of
   reusing the preview, and by widening `snapshot.tsx`'s fallback paint
   timeout `300ms → 600ms` and the post-decode settle delay `200ms → 500ms`.

**PR #6** (2026-08-28, separate session, branch `claude/preserve-manual-zoom`)
— follow-up bug in PR #5's fix: React Flow's `<Controls>` zoom in/out/
fit-view buttons trigger `onMoveStart` the same *programmatic* way the
app's own `setViewport` recenter call does, so inspecting the event alone
couldn't tell them apart — clicking a Controls button wasn't recognized as
"user interaction", so adding a branch afterward still reset the view.
Fixed by having the app flag its *own* upcoming `setViewport` call via an
`isOwnViewportChangeRef` before it runs (with a 50ms-timeout safety net in
case the viewport doesn't actually change and `onMoveStart` never fires to
clear it), instead of trying to infer intent from the event object. Any
other `onMoveStart` — wheel/touch/drag pan/zoom, or a Controls click — is
now correctly treated as real user interaction.

**PR #8** (2026-08-28, separate session, branch `claude/selfie-camera-desktop`)
— the onboarding "צלם סלפי" button used `<input type="file" capture="user">`,
which most **desktop** browsers simply ignore (they open a plain file picker,
no camera) — only mobile browsers honor `capture`. Added
`CameraCaptureModal.tsx`: a `getUserMedia`-based live camera modal (mirrored
preview + capture button) used whenever `navigator.mediaDevices?.getUserMedia`
exists, falling back to the old file-input flow only when it's genuinely
unsupported. `Onboarding.tsx`'s `supportsCameraCapture` constant gates which
path is used.

**PR #9, #10, #11** (2026-08-31) — user asked to embed the official Hotam
logo (from Hotam's own brand asset library, `hotam-brand` skill) into the
app. Added as `src/assets/hotam-logo.png`, then wired in three places:
- **#9**: `Toolbar.tsx` — top-right of the toolbar next to the map title
  (`.toolbar-logo`, 28px tall), matching Hotam's own placement rule for RTL.
- **#10**: `Onboarding.tsx` — centered above the welcome heading
  (`.onboarding-logo`, 40px tall).
- **#11**: `src/export/snapshot.tsx` — drawn directly onto the rasterized
  canvas (top-right, sized as 3.5% of page height so it scales with DPI)
  *after* the map image itself, inside `renderMapSnapshot()`. Since that
  function is the one shared rasterizer behind print, PDF export, the
  print-preview thumbnail, and WhatsApp sharing, this single change brands
  all four outputs consistently — no per-caller changes needed. Positioned
  within the page's own margin band so it never overlaps map content.

## Gotchas / non-obvious things worth knowing before touching export code

1. **React Flow edges vanish from `html-to-image` captures.** React Flow
   draws every edge inside an `<svg class="react-flow__edges">` that has NO
   explicit width/height — it relies on `overflow: visible` (from React
   Flow's own stylesheet) to paint the absolutely-positioned path content
   outside its own nominal (0×0 or UA-default 300×150) box. This works fine
   live. `html-to-image`'s own `toJpeg`/`toPng` serialize the DOM into an
   SVG `data:` URL, load it into an `Image`, and `drawImage()` it onto a
   canvas immediately on the image's `load` event — but the nested `<svg>`
   apparently doesn't reliably finish painting internally by the time that
   fires, so edges silently vanish from the raster. **Proof the
   serialization itself is correct**: rendering the exact same intermediate
   SVG `data:` URL as a plain `<img>` tag shows the edges fine — the bug is
   specifically in `toJpeg`/`toPng`'s internal timing, not the markup.
   Fix (in `src/export/snapshot.tsx`): use `toSvg()` instead of `toJpeg()`,
   then manually `img.decode()` + wait 2×`requestAnimationFrame` + a settle
   timeout, THEN draw to our own canvas. Do not "simplify" this back to
   `toJpeg`/`toPng` without re-verifying edges survive — the race is real
   and was reproduced/confirmed via isolated repro pages, not guessed. The
   settle timeout (currently 500ms, plus a 600ms fallback paint timeout
   before that) started at 200ms/300ms but was widened in PR #5 after
   mobile devices — slower at finishing that same internal paint — still
   dropped edges at the original values; if edges ever go missing again
   specifically on phones/slow hardware, widening these further is the
   first thing to try, not re-architecting the capture.
2. **`html2canvas` (bundled transitively via `jspdf`, not a direct
   dependency) is NOT a safe drop-in replacement** for the above — it has
   its own CSS parser and throws `"unsupported color function "color"` on
   the `color-mix()` calls used throughout this session's node/branch-color
   CSS. If ever switching rasterizers, either stop using `color-mix()` or
   verify html2canvas's CSS support first.
3. **`data:` URL downloads can lose Hebrew/non-ASCII filenames** in at
   least some Chromium builds (`a.download = 'המפה שלי.jpg'` saved as a
   generic "download" file) — verified isolated ASCII names work fine, the
   difference is specifically non-ASCII. The WhatsApp-share fallback path
   works around this by using a `Blob`/`URL.createObjectURL()` instead of
   a raw `data:` URL for the download anchor, which is more reliable, but
   this may still be worth re-testing on real devices if a user reports it.
4. **Export mode (`isExport` from `ExportModeContext`) must keep the same
   DOM footprint as live mode**, just visually hidden (`visibility: hidden`
   via `.mm-invisible`), never conditionally unmounted — `renderMapSnapshot`
   pins each node to its live-measured `sizes[id]` width/height
   (`forceSize: true` in `flowGraph.ts`), so removing content changes what
   fits inside that fixed box without changing the box itself, producing
   mismatched spacing between the live map and the exported image.
5. **Detecting "the user manually moved the viewport" is trickier than it
   looks.** `MindMapCanvas.tsx` needs to stop auto-recentering once the user
   has taken over pan/zoom, but React Flow's `onMoveStart` fires the same
   way — with no distinguishing "real" event — for actual touch/wheel/drag
   input AND for the `<Controls>` zoom buttons AND for the app's own
   programmatic `reactFlow.setViewport(...)` recenter call. Inspecting the
   callback's event argument can only ever separate one of those cases from
   the other two, not all three apart. The working approach: have the app
   flag its *own* upcoming `setViewport` call ahead of time
   (`isOwnViewportChangeRef`) and clear the flag in `onMoveStart` — anything
   that fires `onMoveStart` without that flag set (Controls clicks included)
   is real user interaction. A timeout safety net clears the flag if
   `setViewport` doesn't actually change anything (then `onMoveStart` never
   fires to clear it itself).
6. Local dev in this sandboxed environment: `npm install` was needed
   (node_modules wasn't pre-populated); Playwright is available globally at
   `/opt/node22/lib/node_modules/playwright` (not as a project dependency —
   import via `import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'`
   from a plain `.mjs` script run with plain `node`), Chromium binary at
   `/opt/pw-browsers/chromium`.
7. `src/assets/hotam-logo.png` (the Hebrew wordmark + spark variant) was
   copied in from Claude's own `hotam-brand` skill asset library
   (`assets/logo/hotam-logo-hebrew.png` in that skill), not authored in this
   repo — if it ever needs replacing (e.g. the English/Arabic/white variant,
   or a design refresh), pull the updated file from that same skill rather
   than re-creating it, and keep it unmodified per Hotam's own brand rules
   (no recoloring, no distortion, no effects).

## Git workflow reminder for this repo

The repo owner has been merging every PR immediately (squash merge) and
asking to see the live site — every round so far has gone: implement →
build+lint → browser-verify → commit → push → open PR → merge → confirm
GitHub Pages deploy succeeded. Different sessions have used different
branch names (e.g. `claude/mind-map-improvements-2rrb9e`,
`claude/preserve-manual-zoom`) — the name doesn't matter, but the pattern
does: **check `master` for commits you don't recognize before starting**
(another session may have merged work since you last looked — this
happened between PR #4 and #5 above), and once a PR merges, restart your
branch from `origin/master` before making further changes
(`git fetch origin master && git checkout -B <branch-name> origin/master`)
rather than stacking new commits on already-merged history.
