# Doppelkopf

Doppelkopf im Browser mit Freunden, mit Kamerabild aller Mitspieler.
Frontend: React, Vite, Tailwind und Motion. Schriften: Big Shoulders Display für Überschriften, IBM Plex Mono für Labels, Geist für Text (alle selbst gehostet, keine Anfragen an Google). Backend: Supabase (Postgres, Realtime, Edge Function).

**Live:** https://mlangenhan.github.io/Doppelkopf/

## Funktionen

- **Klassische Regeln** mit Hausregeln, die pro Tisch eingestellt werden:
  - mit oder ohne Neunen
  - Dullen-Regel (erste, zweite oder zweite nur im letzten Stich)
  - Sonderpunkte: Doppelkopf, Fuchs, Karlchen und Schweinchen, jeweils abschaltbar (Schweinchen ist standardmäßig aus)
  - Ansagen: Re/Kontra, keine 90/60/30, schwarz
  - Vorbehalte: Hochzeit, Armut (bei genau 3 Trümpfen), alle Soli einzeln wählbar, Schmeißen (über 80 Augen, 5 Könige, weniger als 3 Trümpfe, 5 Neunen)
  - stilles Solo
- **4 oder 5 Spieler**: Zu fünft setzt der Geber aus und schaut per Kamera zu.
- **Kamera**: Alle sehen sich gegenseitig, direkt per WebRTC (peer-to-peer). Supabase Realtime dient nur zum Verbindungsaufbau. Tab-Wechsel und kurze Funklöcher überstehen die Verbindungen; beendet das Handy die Kamera, wird sie beim Zurückkehren automatisch neu geholt. Ob die Kamera an oder aus ist, merkt sich der Browser.
- **Statistik** über alle Abende mit Aufschlüsselung je Spieler: Siegquote, Ø-Punkte, längste Siegesserie, bestes und schlechtestes Spiel, Punkteverlauf, Re/Kontra, Spielarten (Soli getrennt nach selbst gespielt und dagegen) und Partner. Dazu ein Punktezettel je Abend.
- **Punkte-Aufschlüsselung**: Für die letzten Spiele sieht man, wie sich die Punkte zusammensetzen (Gewonnen, Ansagen, keine 90, Gegen die Alten, Fuchs, Doppelkopf, Karlchen …) – im Spiel unter „Punkte und Regeln“ und auf der Statistikseite.
- **Übungsmodus** gegen drei Bots, ohne Konto und ohne Server, in drei Stärken (oben umschaltbar, wird gemerkt). Die Bots sehen nie fremde Karten, nur was ein Mensch am Platz auch wüsste:
  - **Leicht**: spielt regelkonform, nimmt wertvolle Stiche mit, macht aber oft Fehler.
  - **Mittel**: denkt in Parteien (schmieren beim Partner, Fuchs retten, sichere Stiche), sagt mit starker Hand an und spielt mit sehr starker Hand Soli oder Armut.
  - **Schwer**: verteilt die unbekannten Karten passend zu allem Gesehenen (Fehlfarben, Kreuz-Damen, Ansagen) immer wieder neu, spielt jede mögliche Karte bis zum Spielende durch und nimmt die mit dem besten Ergebnis. Ansagen nach geschätzter Siegchance.
  - Stärkevergleich: `TURNIER=1 npx vitest run tests/bot-tournament.test.ts`
- **Seitenleiste** (Symbol neben der Infozeile): Punkte, letzte Spiele und Hausregeln. Der Gastgeber kann die Regeln dort zwischen den Spielen anpassen, sie gelten ab dem nächsten Spiel.
- **Persönliche Einstellungen** (Zahnrad oben rechts): Spielbare Karten hervorheben lässt sich abschalten, um ohne Hilfe zu spielen. Jeder Effekt (Zeiger, Neigung, Trumpf-Einschlag, große Momente, Auswertung, Konfetti, Atmosphäre, 3D-Karten) ist einzeln schaltbar.
- **Karten sortieren**: Trumpf zuerst, Trumpf zuletzt, nach Farben oder eigene Reihenfolge – Karten einfach in der Hand an ihren Platz ziehen. Der Knopf neben der Infozeile schaltet die Sortierung durch.
- **Verlassen**: Zurück zur Übersicht (der Platz bleibt) oder das laufende Spiel für alle abbrechen; ein abgebrochenes Spiel zählt nicht.
- **Handy**: eigenes Layout mit kleinen Kameras oben, Stich in der Mitte und Hand unten.
- **Leertaste**: Eine angehobene Karte spielt man mit der Leertaste aus, ein eigener Stich wird damit genommen. Hilfetexte gibt es keine – nur wer 5 Sekunden nichts tut, bekommt einen kleinen Leertasten-Hinweis.
- **Stich nehmen**: Ein fertiger Stich bleibt liegen, bis der Gewinner ihn mit der Leertaste (oder per Klick) nimmt. Nach 10 Sekunden darf jeder wegräumen. Der letzte Stich ist immer klein sichtbar.
- **Trumpf-Einschlag**: Dulle, Kreuz-Dame und Schweinchen knallen mit Beben, Druckwelle und Sound auf den Tisch.
- **Stichstapel**: Gewonnene Stiche drehen sich um, fliegen zum Gewinner und liegen als sichtbarer Kartenstapel mit Zähler neben seiner Kamera.
- **Augen-Auswertung**: Am Ende zählen die Augen hoch, der Sieger steht erst fest, wenn er die 121er-Marke überquert. Leertaste überspringt, ein zweites Mal gibt das nächste Spiel.
- **Große Momente**: Ansagen, Soli, Hochzeit, Schweinchen, Doppelkopf, Fuchs und Karlchen erscheinen groß auf der Spielfläche, beim Sieg gibt es Konfetti.
- **Eigener Cursor** als Farbzeichen (wird über einer Karte zu deren Farbe, über dem Stich zur Hand) und **Karten mit 3D-Neigung** und Glanzlicht in der Hand. Beides nur mit Maus und einzeln abschaltbar.
- **Sounds** für Karten, Stiche, Ansagen, „Du bist dran“ und das Spielende – im Browser erzeugt (Web Audio), ohne Audiodateien. An/aus und Lautstärke in den Einstellungen.
- **Kein Schummeln möglich**: Gemischt und gespielt wird ausschließlich in der Edge Function. Jeder Browser bekommt nur die eigene Hand (Row Level Security).

## Einrichtung (einmalig)

### 1. GitHub Pages aktivieren

Repository → **Settings → Pages → Build and deployment → Source: „GitHub Actions“**.
Danach baut jeder Push auf `main` die Seite neu (Workflow `Website (GitHub Pages)`).

### 2. Supabase-Backend deployen

Datenbankschema und Edge Function werden per GitHub Action deployt. Dafür braucht es zwei Secrets.
Repository → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret                  | Wo bekomme ich das?                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_ACCESS_TOKEN` | supabase.com → Account (oben rechts) → **Access Tokens** → „Generate new token“                                         |
| `SUPABASE_DB_PASSWORD`  | Das Datenbank-Passwort aus der Projekterstellung (zurücksetzen unter Project Settings → Database, falls vergessen)      |

Danach unter **Actions → „Backend (Supabase)“ → „Run workflow“** einmal manuell starten.
Später läuft der Workflow automatisch, sobald sich etwas unter `supabase/` ändert.

### 3. Supabase-Auth einstellen

Im Supabase-Dashboard → **Authentication → URL Configuration**:

- **Site URL:** `https://mlangenhan.github.io/Doppelkopf/`
- **Redirect URLs:** `https://mlangenhan.github.io/Doppelkopf/**` und für die Entwicklung `http://localhost:5173/**`

Empfehlung für eine private Freundesrunde: **Authentication → Sign In / Providers → Email → „Confirm email“ ausschalten**.
Dann ist man nach der Registrierung sofort drin. Der eingebaute Mailversand von Supabase schafft ohnehin nur wenige Mails pro Stunde.

## Entwicklung

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Engine-Tests (Regeln, Abrechnung, 1500 Zufallsspiele)
npm run build
```

Die Supabase-URL und der Publishable Key stehen in `.env`. Beide sind öffentlich und für den Browser gedacht.
Ein optionaler TURN-Server für Kameraverbindungen aus restriktiven Netzen (Firma, manche Mobilfunknetze) lässt sich dort über `VITE_TURN_URL`, `VITE_TURN_USERNAME` und `VITE_TURN_CREDENTIAL` eintragen.

## Aufbau

```
supabase/
  functions/_shared/engine/   Spiel-Engine (reines TypeScript, läuft in Browser und Deno)
    cards.ts                  Karten, Augen, Mischen
    rules.ts                  Trumpf-Reihenfolge, Bedienpflicht, Stichauswertung
    game.ts                   Spielablauf: Vorbehalte, Armut, Hochzeit, Stiche, Ansagen
    scoring.ts                Abrechnung (angelehnt an DDV-Regeln)
    view.ts                   Was alle sehen dürfen (ohne Hände)
  functions/game/             Edge Function: austeilen und Züge prüfen/speichern
  migrations/                 Tabellen, RLS, RPCs
src/
  pages/                      Login, Start, Tisch, Statistik, Übung
  components/                 Tisch, Hand, Stich, Video, Dialoge
  lib/                        Supabase, Realtime-Sync, WebRTC, Bots, Statistik
public/cards/                 Kartenbilder (eine SVG pro Karte)
tests/                        Vitest-Tests (Engine, Bots, Statistik); bot-tournament nur mit TURNIER=1
```

## Abrechnung

| Punkt                                                | Wert                    |
| ---------------------------------------------------- | ----------------------- |
| Gewonnen                                             | 1                       |
| Gegen die Alten (Kontra gewinnt, kein Solo)          | 1                       |
| Re bzw. Kontra angesagt                              | je 2                    |
| Keine 90 / 60 / 30 / schwarz abgesagt                | je 1                    |
| Keine 90 / 60 / 30 / schwarz gespielt                | je 1                    |
| 120 gegen keine 90, 90 gegen keine 60, …             | je 1                    |
| Doppelkopf, Fuchs gefangen, Karlchen                 | je 1 (nicht im Solo)    |

Im Solo zählt der Spielwert für den Solisten dreifach.

## Lizenzen

Die Kartenbilder sind die [SVG vector playing cards](https://revk.uk/2018/06/svg-vector-playing-cards.html) von Adrian Kennard (RevK), Lizenz CC0 (siehe `public/cards/LICENSE.txt`). Angepasst: Bube und Dame tragen die deutschen Eckbuchstaben B und D, die Rückseite ist blau. Eine Datei pro Karte in `public/cards/` (`AH.svg` = Herz-Ass, `T` = Zehn, `back.svg` = Rückseite).
