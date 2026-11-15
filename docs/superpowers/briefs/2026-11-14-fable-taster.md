# Fable-Vorgeschmack: drei Richtungen für den Stufenbaum, in Blender entworfen

Als Prompt in eine neue Session einfügen. Die Session braucht beide Ordner (`~/code/blender-playground` und `~/code/ftree/ftree`) sowie den Blender-MCP-Server. Blender muss laufen und das MCP-Add-on verbunden sein.

---

Ich möchte sehen, was du gestalterisch draufhast, und zwar mit Blender als Werkstatt. Es geht um einen Vorgeschmack, nicht ums fertige Produkt: ein kurzer, mutiger Probebau.

**Worum es geht:** ftree ist eine Familienbaum-App (Next.js + React Three Fiber, `~/code/ftree/ftree/ui`). Die Darstellung „Stufenbaum“ zeigt eine Familie als 3D-Baum: eine Stufe pro Generation, die Ältesten oben. Jedes Paar bringt zwei eigene Stränge mit, die sich vom Boden bis zu ihrer Stufe umeinander winden. Kinderlose ohne Partner sind Zweige. Der Stamm ist unten am dicksten, und jedes neue Mitglied lässt den Baum wachsen. Die Logik stimmt schon, aber optisch ist es noch eine Skizze aus Rohren. Mein Ziel ist ein ikonischer, epischer, cleaner und emotionaler Baum, etwa wie der goldene Baum aus *The Fountain*: eine edle Silhouette, die man von Weitem wiedererkennt. Nicht kitschig und nicht überladen.

**Lies zuerst:**
- Im Blender-Playground: `LOG.md` (vor allem die Erkenntnisse aus Experiment 03 und 04) und `PROMPTS.md`. Experiment `04-gold-look` hat schon ein Gold-Material, Licht und einen glTF-Export samt Three.js-Testviewer (`viewer/`).
- In ftree: `AGENTS.md`, `docs/superpowers/specs/2026-11-14-twined-tiered-tree-design.md`, `ui/app/twinedLayout.ts`, `ui/app/TwinedTree.tsx`. Für die vollständigen Form-Regeln siehe `docs/superpowers/briefs/2026-11-14-twined-tree-form.md`.

**Den heutigen Stand anschauen:** In ftree startet `./start.sh` den Stack, falls er nicht schon läuft. Dann `http://localhost:3000` öffnen, die Familie „Stufen 7 Grosse Familie“ wählen und im Evolution-Panel unter „Ansichts-Labor“ die Darstellung „Stufenbaum“ einstellen. Mit „Wachstum abspielen“ siehst du das Wachstum. Mach einen Screenshot als Ausgangspunkt.

## Phase 1: Drei Richtungen in Blender

Entwirf in Blender drei deutlich verschiedene Richtungen für die Form. Alle drei zeigen dieselbe Familie, die Struktur von „Stufen 7 Grosse Familie“:
- Generation 1: das Paar Georg und Gerda.
- Generation 2: das Paar Sven und Sonja, das Paar Paul und Petra, und Udo, kinderlos.
- Generation 3: das Paar Kurt und Karin, Lena (kinderlos, Kind von Sven und Sonja), das Paar Max und Mia, und Nils (kinderlos, Kind von Paul und Petra).
- Generation 4: zwei Kinder von Kurt und Karin, zwei Kinder von Max und Mia, alle kinderlos.

Karten reichen als schlichte Platzhalter-Rechtecke.

Anregungen für die Richtungen:
- **Skulptural:** Die Stränge verschmelzen zu einem gemeißelten Stamm mit sichtbaren Graten, Wurzeln greifen in den Hügel.
- **Luftig-kalligrafisch:** schlanke, lange Bögen, viel leerer Raum, die Karten wie Laternen.
- **Deine eigene Idee,** gern überraschend.

Wenn du Besseres siehst, mach das.

Arbeite so, wie es in `PROMPTS.md` steht:
- Eine eigene Collection pro Richtung, nichts Vorhandenes löschen.
- Nach jedem Schritt einen Screenshot machen, selbst kritisieren und nachbessern.
- Alles im neuen Experiment `experiments/05-fable-directions/` speichern (`.blend` und Renderbilder).

Nutze das Gold-Material und das Licht aus Experiment 04 als Ausgangspunkt, damit ich die Formen schon im richtigen Look sehe. Du darfst den Look verfeinern, wenn es die Form stärker macht.

## Phase 2: Die stärkste Richtung in die App bringen

Wähle die stärkste Richtung und zeig, wie sie in der App aussähe. Dafür gibt es zwei Wege, wähle den, der schneller überzeugt:
- **Als Regel:** Übertrage die Form in `TwinedTree.tsx`, grob, aber an echten Familien.
- **Als Modell:** Exportiere sie als glTF und zeig sie im Three.js-Viewer des Playgrounds.

Sag dazu, was sich gut aus den Daten erzeugen ließe und was nur in Blender gut aussieht.

**Das darf nicht verloren gehen,** sonst verliert der Baum seine Bedeutung:
- Ältere stehen über Jüngeren, eine Stufe pro Generation.
- Paare sind als umeinander gewundene Stränge erkennbar, man sieht, wie viele Paare es gibt.
- Jede Karte hängt frei, und vorne bleibt der Blick auf den Stamm frei.
- In der App wird später alles aus den Daten erzeugt (1 bis etwa 100 Personen). Blender liefert die Form-Idee und den Look, keine handplatzierten Bäume.
- Das Wachstum funktioniert weiter: Jeder Strang bleibt ein eigenes Stück, das vom Boden bis zur Karte wachsen kann.

Keine Blätter und keine Lianen.

## Was ich am Ende von dir möchte

1. Pro Richtung zwei, drei Renderbilder: von vorne, schräg von oben, und ein Detail, wo sich die Stränge winden oder ein Paar abzweigt.
2. Pro Richtung zwei, drei Sätze: die Idee, was daran stark ist und was schwierig wäre, wenn man sie aus den Daten erzeugen will.
3. Das Ergebnis von Phase 2 als Screenshot.
4. Deine Empfehlung, welche Richtung wir ausbauen sollten und warum.

## Regeln

- Ich bin Blender-Anfänger, also erklär kurz, was du in Blender tust.
- Im Playground nach den Konventionen dort committen (ein Commit pro Schritt, Nachrichten auf Englisch) und `LOG.md` ergänzen.
- In ftree auf einem eigenen Branch arbeiten, ab `main` (falls `feat/ui-grow-the-tiered-tree` noch nicht gemergt ist, ab diesem Branch). Dort nichts committen und keinen PR öffnen, das ist ein Probebau.
- Halte es kurz: lieber drei mutige grobe Entwürfe als einen polierten.
