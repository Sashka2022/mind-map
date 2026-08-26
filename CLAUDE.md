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
    Toolbar.tsx                 save / print-PDF / reset buttons
    Onboarding.tsx               first-run: map title + optional photo
    SidePhotoPanel.tsx           persistent corner panel mirroring root photo
    PrintPreviewModal.tsx        print/PDF modal + WhatsApp share button
    nodeTypes.ts / nodes/RootNode.tsx / nodes/BranchNode.tsx / nodes/NodeBox.tsx
                                  NodeBox is the ONE shared component that
                                  renders all node chrome (root/level-1/leaf
                                  are CSS-class variants of the same component)
  export/
    snapshot.tsx                renderMapSnapshot(): the shared rasterizer
                                  used by both print and PDF export
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

## This session's changes (2026-08-26), 3 merged PRs

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
   then manually `img.decode()` + wait 2×`requestAnimationFrame` + a 200ms
   settle timeout, THEN draw to our own canvas. Do not "simplify" this back
   to `toJpeg`/`toPng` without re-verifying edges survive — the race is real
   and was reproduced/confirmed via isolated repro pages, not guessed.
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
5. Local dev in this sandboxed environment: `npm install` was needed
   (node_modules wasn't pre-populated); Playwright is available globally at
   `/opt/node22/lib/node_modules/playwright` (not as a project dependency —
   import via `import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'`
   from a plain `.mjs` script run with plain `node`), Chromium binary at
   `/opt/pw-browsers/chromium`.

## Git workflow reminder for this repo

Working branch: `claude/mind-map-improvements-2rrb9e`. The repo owner has
been merging each PR immediately (squash merge) and asking to see the live
site — so far every round in this thread has gone: implement → build+lint
→ browser-verify → commit → push → open PR → merge → confirm GitHub Pages
deploy succeeded. If continuing work here, remember: once a PR merges, the
next commits must restart the branch from `origin/master`
(`git fetch origin master && git checkout -B claude/mind-map-improvements-2rrb9e origin/master`)
before making further changes, per the standing instruction not to stack
new commits on already-merged history.
