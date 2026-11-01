# Prototypes (Horizont v2)

Sources of the interactive boards on the design canvas: https://claude.ai/artifact/NFx5oNnHNpLBUWvxiXJ6Az (page "Version 2 · Horizont").

- `Landing.dc.html` – 1 · landing page at `/` (3D / TRON).
- `Willkommen.dc.html` – 2 · signed in without a tree: welcome card → tree → intro tour.
- `Einladung.dc.html` – 3 · invitation → own place in the tree.
- `Tron.dc.html`, `Baum3D.dc.html` – 4 and 5 · the same tree view in both themes (identical markup, only the `thema` default differs).
- `ftree-scene.jpg` – screenshot of the current 3D scene used as background.

These are canvas files (Design Component format): they render only on the canvas, not standalone.
Images are referenced as `/_blob/…` assets of the canvas; `ftree-scene.jpg` is the local copy.
They are reference material, not production code; the rules live in `../README.md`, `../tokens.css`, and `../components.md`.
