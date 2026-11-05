import type { Page } from "./types";

export const de: Page[] = [
	{
		path: "index.mdx",
		content: `---
title: Willkommen bei routess
description: Ein kurzer Rundgang durch routess und den Aufbau des Benutzerhandbuchs.
translationStatus: machine-draft
---

routess ist eine Routenplanungs-App, mit der du Wegpunkt für Wegpunkt eine Route auf einer Karte skizzierst und für später speicherst. Dieses Handbuch richtet sich an **Menschen, die die routess-App nutzen**: Programmierkenntnisse sind nicht nötig.

![Der routess-Planer mit einer Route durch Gent](/guide/route-overview.jpg)

## Was du tun kannst

- Mit Google oder per E-Mail anmelden und in Sekunden mit der Routenplanung beginnen
- Auf die Karte klicken, um Wegpunkte zu setzen, sie per Ziehen umsortieren und Änderungen rückgängig machen
- Gesamtdistanz und geschätzte Dauer live aktualisieren sehen, während du bearbeitest
- Routen in deiner Bibliothek speichern und mit Tags und Sammlungen ordnen
- Freunden folgen, sehen, was sie veröffentlichen, und euch gegenseitig Routen schicken
- GPX importieren und exportieren oder routess als App installieren und offline nutzen
- Die App auf Englisch, Niederländisch, Französisch oder Deutsch umstellen

## Wie dieses Handbuch aufgebaut ist

- **[Erste Schritte](/de/guide/getting-started/sign-in)**: Anmelden und in 3 Minuten deine erste Route planen
- **[Routen](/de/guide/routes/creating-routes)**: Routen erstellen, bearbeiten, speichern und teilen
- **[Bibliothek](/de/guide/library/your-library)**: Deine gespeicherten Routen, Tags, Favoriten und Sammlungen
- **[Social](/de/guide/social/profiles)**: Profile, Folgen, der Feed und dein Posteingang
- **[Karte](/de/guide/map/navigation)**: Verschieben, zoomen, Stile ändern, Standort verfolgen
- **[Konto](/de/guide/account/profile)**: Profil, Sprache und Kontolöschung
- **[Fehlerbehebung](/de/guide/troubleshooting)**: Lösungen für häufige Probleme
- **[FAQ](/de/guide/faq)**: Schnelle Antworten

Suchst du stattdessen die technische Dokumentation? Dann geht es zu den [Entwicklerdocs](/docs).
`,
	},
	{
		path: "faq.mdx",
		content: `---
title: FAQ
description: Schnelle Antworten auf häufige Fragen.
translationStatus: machine-draft
---

## Ist routess kostenlos?

Ja. routess ist quelloffen und selbst gehostet, und eine eigene Instanz hat alle Funktionen freigeschaltet. Die gehostete Version unter routess.com ist kostenlos für Planen, GPX-Import und -Export, 3 generierte Routen pro Tag mit Anmeldung und bis zu 5 gespeicherte Routen. Pro, ein einmaliger Jahrespass, bringt 50 generierte Routen pro Tag, unbegrenzt gespeicherte Routen, Knotenpunkt-Routengenerierung, Turn-by-Turn-Navigation, Sammlungen und API-Tokens für die CLI und Agents.

## Brauche ich ein Konto?

Nein. Du kannst Routen auch ohne Konto planen, speichern und exportieren: Routen, die du im abgemeldeten Zustand speicherst, bleiben in diesem Browser auf diesem Gerät. Erstelle ein kostenloses Konto (oder melde dich an), und sie wandern hinein, sodass du sie auf jedem Gerät hast, auf dem du dich anmeldest. Veröffentlichen, soziale Funktionen und Synchronisierung brauchen ein Konto.

## Welche Daten speichert routess?

- Deinen Namen und deine E-Mail-Adresse (aus der Google-Anmeldung oder der E-Mail-Registrierung)
- Deine gespeicherten Routen (Wegpunkte und Metadaten)

routess erfasst anonyme Nutzungsereignisse auf einer selbst gehosteten Analyse-Instanz, um zu verstehen, welche Funktionen genutzt werden. Diese Ereignisse enthalten niemals deine E-Mail-Adresse, deine Routennamen oder deine rohe Konto-ID. Es gibt keine Tracker von Drittanbietern.

## Kann ich meine Routen exportieren?

Ja. Öffne eine Route und nutze **Als GPX speichern** in der Seitenleiste, um sie herunterzuladen. Du kannst GPX-Dateien auch in den Planer importieren. Importe für TCX, FIT und KML sind geplant.

## Kann ich eine eigene Kopie betreiben?

Ja, routess ist quelloffen. Siehe **[Entwicklerdocs → Betrieb](/docs/operations/self-host)**.

## Wo melde ich einen Fehler?

[GitHub Issues](https://github.com/robbeverhelst/routess/issues).
`,
	},
	{
		path: "troubleshooting.mdx",
		content: `---
title: Fehlerbehebung
description: Lösungen für häufige Probleme.
translationStatus: machine-draft
---

## Probleme beim Anmelden

- **Das Google-Pop-up wird blockiert.** Erlaube Pop-ups für die routess-Domain und versuche es erneut.
- **"Dieses Konto ist nicht autorisiert."** routess nutzt deine primäre Google-Identität; melde dich zuerst unter \`accounts.google.com\` an.
- **Nach der Anmeldung bleibt ein Ladekreis hängen.** Lade die Seite neu. Falls das Problem bestehen bleibt, lösche die Cookies für die routess-Domain.

## Karte lädt nicht

- Prüfe deine Internetverbindung
- Deaktiviere Werbeblocker und Datenschutz-Erweiterungen für die routess-Domain; Mapbox-Kacheln werden manchmal blockiert
- Probiere einen anderen Browser, um ein Erweiterungsproblem auszuschließen

## Meine Route ist verschwunden

Wenn du nicht angemeldet warst, bleiben Routen nur in deinem Browser und wurden möglicherweise gelöscht. Melde dich beim nächsten Mal an, um sie zu behalten.

## Standort funktioniert nicht

Siehe [Karte → Dein Standort](/de/guide/map/your-location).

Kommst du nicht weiter? [Erstelle ein Issue auf GitHub](https://github.com/robbeverhelst/routess/issues).
`,
	},
	{
		path: "support.mdx",
		content: `---
title: Support
description: Wo du Hilfe bekommst, Fehler meldest und Funktionen vorschlägst.
translationStatus: machine-draft
---

## Einen Fehler gefunden?

Erstelle ein Issue auf [GitHub Issues](https://github.com/robbeverhelst/routess/issues). Gib dabei an:

- Was du getan hast, was du erwartet hast und was stattdessen passiert ist
- Deinen Browser und dein Betriebssystem
- Einen Screenshot, falls das Problem optisch ist

## Eine Funktion gewünscht?

Funktionswünsche laufen ebenfalls über [GitHub Issues](https://github.com/robbeverhelst/routess/issues). Beschreibe das Problem, das du lösen willst, nicht nur die Lösung, die du dir vorstellst.

## Fragen zu deinen Daten

- **Alles exportieren**: Deine Profileinstellungen enthalten einen vollständigen Kontoexport (ein ZIP mit deinen Daten und einer GPX-Datei pro Route).
- **Konto löschen**: Siehe [Konto löschen](/de/guide/account/deleting-account). Bei der Löschung gibt es eine 30-tägige Kulanzfrist, in der du es dir durch erneutes Anmelden anders überlegen kannst.
- **Datenschutz**: Siehe [Datenschutz](/de/guide/privacy).

## Häufige Probleme

Sieh zuerst in der [Fehlerbehebung](/de/guide/troubleshooting) nach; die häufigsten Anmelde- und Kartenprobleme werden dort behandelt.
`,
	},
	{
		path: "privacy.mdx",
		content: `---
title: Datenschutz
description: Welche Daten routess speichert und wie du sie kontrollierst.
translationStatus: machine-draft
---

routess ist quelloffen und so gebaut, dass deine Daten dir gehören. Diese Seite ist die Kurzfassung für App-Nutzende. Die vollständige Erklärung mit Rechtsgrundlagen, Empfängern und Speicherfristen findest du unter [routess.com/privacy](https://routess.com/privacy).

## Was routess speichert

- Deinen Namen und deine E-Mail-Adresse (aus der Google-Anmeldung oder der E-Mail-Registrierung)
- Deinen Handle und dein Avatar, das öffentliche Gesicht deines Profils
- Deine gespeicherten Routen und Sammlungen (Wegpunkte, Geometrie und Metadaten wie Name, Aktivität, Tags und Sichtbarkeit)
- Deine Sitzungen, inklusive der IP-Adresse und des Browsers, mit dem du dich angemeldet hast, 7 Tage lang

## Analyse

routess nutzt Umami, ein cookieloses Analysewerkzeug, selbst gehostet auf der routess-Infrastruktur. Kein Drittanbieter erhält diese Daten und sie werden nie für Werbung genutzt.

Neben Seitenaufrufen erfasst die App benannte Produktereignisse, etwa das Erstellen einer Route oder den Import einer GPX-Datei, mit Kontext wie Distanz, Anzahl der Wegpunkte und der gewählten Sichtbarkeit. Ereignisse angemeldeter Nutzender tragen eine **pseudonyme** Kennung: einen gesalzenen Hash deiner Konto-ID, serverseitig berechnet. Das ist nicht deine rohe Konto-ID und lässt sich vom Browser aus nicht umkehren, verknüpft aber deine Sitzungen miteinander. Deshalb nennen wir es pseudonym statt anonym.

Suchbegriffe werden nur als Längenkategorie erfasst, nie als der Text, den du getippt hast.

**Abschalten**: Einstellungen → Privatsphäre & Teilen → Nutzungsstatistiken. Danach wird nichts mehr gesendet, auch keine Seitenaufrufe. Die Do-Not-Track-Einstellung deines Browsers wird automatisch beachtet.

## Fehlerberichte

Absturzberichte gehen an ein selbst gehostetes GlitchTip. Sie enthalten den Fehler, die Seite und die Form dessen, was du bearbeitet hast (Anzahl Wegpunkte, Distanzen), aber nie deine Koordinaten, deine E-Mail-Adresse oder deinen Namen.

## Zugriff durch Administratoren

Administratoren können Konten nach Name oder E-Mail-Adresse durchsuchen, deine aktiven Sitzungen samt IP-Adressen einsehen und jede Route öffnen, auch private. Das dient dem Support und der Missbrauchsbearbeitung, und jede Aktion wird protokolliert. Privat heißt privat gegenüber anderen Nutzenden, nicht verschlüsselt gegenüber uns. Selbst hosten ist die Antwort, wenn dir das wichtig ist.

## Deine Kontrollmöglichkeiten

- **Export**: Lade eine vollständige Kopie deines Kontos (JSON + GPX pro Route) aus deinen Profileinstellungen herunter.
- **Sichtbarkeit**: Jede Route ist standardmäßig privat. Du entscheidest pro Route, ob sie privat, nicht gelistet oder öffentlich ist. Eine öffentliche Route verrät, wo du warst, also kürze Anfang und Ende gegebenenfalls.
- **Löschen**: Beim Löschen deines Kontos werden deine Routen, dein Profil und deine Analyse-Ereignisse nach einer 30-tägigen Kulanzfrist entfernt. Siehe [Konto löschen](/de/guide/account/deleting-account).

## Selbst hosten

Wenn du deine eigene routess-Instanz betreibst, bleiben deine Daten auf deiner Infrastruktur. Es ist kein Nachhausetelefonieren eingebaut, und Analyse sowie Fehlerberichte sind aus, sofern du sie nicht konfigurierst.
`,
	},
	{
		path: "whats-new.mdx",
		content: `---
title: Neuigkeiten
description: Wo du routess-Releases und -Änderungen verfolgst.
translationStatus: machine-draft
---

routess wird kontinuierlich ausgeliefert: Jede zusammengeführte Verbesserung wird automatisch mit einer Versionsnummer und Release Notes veröffentlicht.

- **Release Notes**: Die [GitHub-Releases-Seite](https://github.com/robbeverhelst/routess/releases) listet jede Version mit ihren Änderungen auf.
- **Auf dem Laufenden bleiben**: Beobachte das [GitHub-Repository](https://github.com/robbeverhelst/routess), um über neue Releases benachrichtigt zu werden.

Du hostest selbst? Lege mit der Variable \`ROUTESS_TAG\` eine bestimmte Version fest; siehe [Entwicklerdocs → Selbst hosten](/docs/operations/self-host).
`,
	},
	{
		path: "getting-started/sign-in.mdx",
		content: `---
title: Anmelden
description: Melde dich mit Google oder per E-Mail und Passwort bei routess an.
translationStatus: machine-draft
---

Du kannst dich bei routess mit deinem Google-Konto oder mit einer E-Mail-Adresse und einem Passwort anmelden.

## Mit Google anmelden

1. Öffne routess und klicke oben rechts auf **Mit Google anmelden**.
2. Ein Google-Pop-up erscheint. Wähle das Konto aus, das du nutzen möchtest.
3. Bestätige die angeforderten Berechtigungen.
4. Du bist zurück in routess und angemeldet.

![Der routess-Anmeldebildschirm mit Optionen für Google, E-Mail und anonyme Nutzung](/guide/welcome.jpg)

### Was routess sehen kann

- Deinen Namen und dein Profilbild
- Deine E-Mail-Adresse (um dein Konto zu identifizieren)

Mehr nicht. routess liest niemals dein Gmail, Drive oder deinen Kalender.

## Per E-Mail anmelden

1. Klicke im Anmeldebildschirm auf **Per E-Mail anmelden**.
2. Um ein Konto zu erstellen, wähle **Konto erstellen**, gib deine E-Mail-Adresse und ein Passwort ein und bestätige den Verifizierungslink, den routess dir per E-Mail schickt.
3. Um dich später anzumelden, gib dieselbe E-Mail-Adresse und dasselbe Passwort ein.

Passwort vergessen? Nutze **Link zum Zurücksetzen senden** im Anmeldebildschirm und folge der E-Mail.

Wenn du dich mit Google registriert hast, kannst du später in deinen Profileinstellungen ein Passwort hinzufügen, sodass beide Methoden für dasselbe Konto funktionieren.

## Abmelden

Öffne das Menü oben rechts und klicke auf **Abmelden**. Deine Routen bleiben auf dem Server gespeichert und erscheinen wieder, wenn du dich das nächste Mal anmeldest.

## Probleme beim Anmelden?

Siehe [Fehlerbehebung → Probleme beim Anmelden](/de/guide/troubleshooting).
`,
	},
	{
		path: "getting-started/your-first-route.mdx",
		content: `---
title: Deine erste Route
description: Plane deine erste Route in unter 3 Minuten.
translationStatus: machine-draft
---

Lass uns schnell eine Route von Grund auf planen.

![Der leere Planer, bereit für einen ersten Wegpunkt](/guide/planner-empty.jpg)

## 1. Klicke deinen Startpunkt an

Klicke irgendwo auf die Karte. Ein Wegpunkt erscheint: Das ist dein Startpunkt. Der erste Wegpunkt wird grün dargestellt.

## 2. Wegpunkte hinzufügen

Klicke erneut, um den nächsten Wegpunkt hinzuzufügen. routess verbindet deine Wegpunkte mit einer Linie und zeigt die Gesamtdistanz und -dauer in der Seitenleiste an.

![Drei Wegpunkte, verbunden durch eine berechnete Routenlinie durch Gent](/guide/route-overview.jpg)

## 3. Per Ziehen umsortieren

Ziehe einen beliebigen Wegpunkt, um ihn umzusortieren. Die Route aktualisiert sich sofort.

## 4. Einen Fehler rückgängig machen

Falsch geklickt? Drücke **Rückgängig** (oder \`Ctrl/Cmd + Z\`). Du kannst Schritt für Schritt durch jede Änderung zurückgehen, die du vorgenommen hast.

## 5. Deine Route speichern

Routen werden automatisch gespeichert, sobald du angemeldet bist. Lade die Seite neu, und deine Route ist immer noch da.

## Nächste Schritte

- Lerne die Bearbeitungswerkzeuge in **[Routen → Routen bearbeiten](/de/guide/routes/editing-routes)** kennen
- Passe das Aussehen unter **[Karte → Stile](/de/guide/map/styles)** an
`,
	},
	{
		path: "getting-started/interface-tour.mdx",
		content: `---
title: Rundgang durch die Oberfläche
description: Ein kurzer Rundgang durch die routess-Oberfläche.
translationStatus: machine-draft
---

![Der routess-Planer mit einer aktiven Route](/guide/route-overview.jpg)

## Die Karte

Nimmt den größten Teil des Bildschirms ein. Verschiebe sie durch Ziehen, zoome mit dem Scrollrad oder den Schaltflächen \`+\` / \`-\` in der Kartenwerkzeugleiste.

## Die linke Leiste

Die Symbolspalte ganz links wechselt zwischen den Bereichen:

- **Planen**: die Route, die du gerade aufbaust
- **Bibliothek**: deine [gespeicherten Routen und Sammlungen](/de/guide/library/your-library)
- **Entdecken**: [öffentliche Routen aus der Community](/de/guide/discover) für den Bereich, den du dir gerade ansiehst
- **Social**: dein [Feed, Posteingang und die Personen, denen du folgst](/de/guide/social/follow-and-feed)
- **Einstellungen**: Sportarten, Einheiten, Sprache, Karten- und Datenschutzoptionen

Am unteren Ende der Leiste: [Benachrichtigungen](/de/guide/social/notifications), der Umschalter für den Dunkelmodus und dein Konto.

## Die Planen-Seitenleiste

Zeigt deine aktuelle Route: die Aktivitätsreiter (Laufen, Radfahren, Gehen), die Endpunkte **Von** und **Nach** mit Ortsnamen, die nummerierten Wegpunkte dazwischen, die Gesamtstatistik der Route sowie das Höhen- und Untergrunddiagramm. Klicke einen Wegpunkt an, um die Karte darauf zu fokussieren. Die Schaltflächen **Speichern**, Teilen und Importieren befinden sich am unteren Ende.

## Die Kartenwerkzeugleiste

Über die Oberseite der Karte:

- **Suche**: einen Ort finden und die Karte dorthin springen lassen
- **Rundstrecke generieren**: [Vorschläge für Rundtouren](/de/guide/routes/generating-loops) aus einem Startpunkt und einer Distanz
- **Auf mich zentrieren**: die Karte auf deinen Standort zentrieren (fragt beim ersten Mal nach Erlaubnis)
- **Rückgängig / Wiederholen**: durch deine Bearbeitungen gehen
- **Route entfernen**: die aktuelle Route leeren
- **Kartenstil**, **Karte sperren**, **Auf Route fokussieren** sowie Zoom \`+\` / \`-\`

![Die Ortssuche mit Ergebnissen](/guide/search.jpg)

Weiter geht es mit [Routen erstellen](/de/guide/routes/creating-routes).
`,
	},
	{
		path: "getting-started/keyboard-shortcuts.mdx",
		content: `---
title: Tastenkürzel
description: Alle Tastenkürzel in routess.
translationStatus: machine-draft
---

Alle Kürzel verwenden \`Ctrl\` unter Windows und Linux sowie \`Cmd\` unter macOS.

![Die Befehlspalette mit Navigations-, Aktions- und Letzte-Routen-Einträgen](/guide/command-palette.jpg)

| Kürzel | Aktion |
| --- | --- |
| \`Ctrl/Cmd + Z\` | Letzte Routenbearbeitung rückgängig machen |
| \`Ctrl/Cmd + Shift + Z\` | Wiederholen |
| \`Ctrl/Cmd + K\` | Befehlspalette öffnen |
| \`Ctrl/Cmd + D\` | Dunkelmodus umschalten |
| \`Esc\` | Das geöffnete Dialogfenster schließen |

Die Befehlspalette ist der schnellste Weg, um zu Aktionen zu springen, ohne zur Maus zu greifen: Öffne sie und fang an zu tippen.
`,
	},
	{
		path: "routes/creating-routes.mdx",
		content: `---
title: Routen erstellen
description: Wie du Wegpunkte hinzufügst und eine Route auf der Karte aufbaust.
translationStatus: machine-draft
---

![Der erste Wegpunkt, auf der Karte gesetzt](/guide/first-waypoint.jpg)

Eine Route ist einfach eine Liste von Wegpunkten. Um eine zu erstellen, klicke irgendwo auf die Karte.

- Der erste Klick setzt deinen **Startpunkt** (grüner Marker).
- Jeder Klick fügt einen Wegpunkt hinzu (nummerierter Marker).
- routess zeichnet dabei fortlaufend eine Verbindungslinie zwischen ihnen.

## Tipps

- **Halten und ziehen** beim Setzen eines Markers für feine Anpassungen.
- **Rechtsklick** (oder langes Drücken auf Touchgeräten), um einen Wegpunkt zu entfernen.
- **Klicke auf einen leeren Bereich zwischen zwei Wegpunkten**, um in der Mitte einen Wegpunkt einzufügen.

Keine Idee, wohin? Lass routess stattdessen eine [Rundstrecke generieren](/de/guide/routes/generating-loops).

Weiter geht es mit [Routen bearbeiten](/de/guide/routes/editing-routes).
`,
	},
	{
		path: "routes/editing-routes.mdx",
		content: `---
title: Routen bearbeiten
description: Endpunkte, umsortieren, löschen, rückgängig machen, wiederholen und gespeicherte Routen bearbeiten.
translationStatus: machine-draft
---

![Die Wegpunktliste in der Seitenleiste mit Ziehgriffen](/guide/editing-routes.png)

## Endpunkte

Die Seitenleiste beginnt mit den Zeilen **Von** und **Nach**, die als Ortsnamen statt als Koordinaten angezeigt werden. Klicke eine davon an, um sie per Suche zu ersetzen, und nutze die Tausch-Schaltfläche dazwischen, um die Richtung der ganzen Route umzukehren.

Wenn deine Route am selben Ort beginnt und endet, fallen die beiden Zeilen zu einer einzigen Zeile **Rundstrecke ab …** zusammen. Noch keine Rundstrecke? **Zurück zum Start** fügt mit einem Klick einen letzten Abschnitt nach Hause hinzu.

## Nummerierte Wegpunkte

Die Wegpunkte zwischen den Endpunkten sind nummeriert, und dieselben Nummern erscheinen auf den Kartenmarkern, sodass Liste und Karte immer übereinstimmen. Jede Zeile zeigt die Distanz entlang der Route bis zu diesem Punkt.

## Umsortieren

Ziehe einen Wegpunkt-Marker auf der Karte oder ziehe eine Zeile am Ziehgriff in der Seitenleiste. Die Route aktualisiert sich, sobald du loslässt.

## Löschen

Rechtsklick auf einen Wegpunkt auf der Karte (oder tippe ihn auf Touchscreens an), um ihn zu entfernen. Die Route wird um die Lücke herum neu berechnet. Die Zeilenaktionen in der Seitenleiste erscheinen, wenn du mit dem Mauszeiger über eine Zeile fährst.

## Hover-Synchronisierung zwischen Seitenleiste und Karte

Fahre mit dem Mauszeiger über einen Wegpunkt in der Seitenleiste, um ihn auf der Karte hervorzuheben, und über einen Marker auf der Karte, um seine Zeile in der Seitenleiste hervorzuheben. Das funktioniert in beide Richtungen, was praktisch ist, wenn eine lange Route viele Wegpunkte hat.

## Rückgängig / Wiederholen

- **Rückgängig:** Klicke auf die Schaltfläche Rückgängig oder drücke \`Ctrl/Cmd + Z\`
- **Wiederholen:** Schaltfläche Wiederholen oder \`Ctrl/Cmd + Shift + Z\`

routess behält deinen vollständigen Bearbeitungsverlauf für die aktuelle Sitzung.

## Eine gespeicherte Route direkt bearbeiten

Öffne eine Route aus deiner Bibliothek und bearbeite ihren Namen, ihre Beschreibung, ihre Sichtbarkeit oder ihre Wegpunkte direkt. Eine Anzeige "Ungespeicherte Änderungen" erscheint neben dem Titel, solange du ausstehende Bearbeitungen hast. Klicke auf **Speichern**, um sie zu übernehmen, oder auf **Verwerfen**, um zur zuletzt gespeicherten Version zurückzukehren. Wenn du die Seite mit ungespeicherten Änderungen verlässt, fragt routess vorher nach.

## Zurücksetzen

Klicke auf **Zurücksetzen**, um die aktuelle Route vollständig zu leeren. Das lässt sich sofort rückgängig machen, nützlich, falls du sie versehentlich geleert hast.

Das Bearbeiten auf dem Handy funktioniert anders; siehe [routess auf deinem Handy](/de/guide/mobile).
`,
	},
	{
		path: "routes/saving-routes.mdx",
		content: `---
title: Routen speichern
description: Wie routess deine Routen über Sitzungen hinweg sichert.
translationStatus: machine-draft
---

Die Route, an der du arbeitest, wird automatisch in deinem Browser behalten: Lade die Seite neu, und sie ist immer noch da, selbst wenn du nicht angemeldet bist.

![Die Route ist nach einer Seitenaktualisierung weiterhin vorhanden](/guide/route-after-refresh.jpg)

## In deiner Bibliothek speichern

Klicke auf **Speichern** in der Seitenleiste, um die Route mit einem Namen und einer Sichtbarkeit (privat, nicht gelistet oder öffentlich) in deiner Bibliothek abzulegen. Gespeicherte Routen werden in deinem Konto abgelegt und über Geräte hinweg synchronisiert.

Einmal gespeichert, leben Routen in [deiner Bibliothek](/de/guide/library/your-library), wo du sie mit Tags versehen, zu Favoriten machen und in Sammlungen gruppieren kannst.

## Eine Kopie speichern

Du arbeitest an einer gespeicherten Route, möchtest aber das Original behalten? Nutze **Als Kopie speichern** in der Planen-Seitenleiste, um deine Änderungen als neue Route abzulegen und das Original unangetastet zu lassen.

## Was, wenn ich nicht angemeldet bin?

Du kannst trotzdem auf **Speichern** klicken: Die Route wird in diesem Browser auf diesem Gerät gespeichert, mit Namen und Tags, und erscheint in deiner Bibliothek unter **Your routes on this device**. Von dort aus kannst du sie im Planer öffnen, als GPX exportieren oder löschen. Speicherst du erneut, nachdem du eine geöffnet hast, wird sie aktualisiert, statt eine Kopie anzulegen.

Auf dem Gerät gespeicherte Routen bleiben privat. Sie folgen dir nicht auf ein anderes Gerät und gehen verloren, wenn du die Browserdaten löschst. Zum Veröffentlichen oder Teilen einer Route brauchst du ein kostenloses Konto. Wenn du dich auf diesem Gerät anmeldest (oder ein Konto erstellst), wandern die hier gespeicherten Routen als private Routen in dein Konto und verlassen das Gerät. Hat dein Tarif nicht für alle Platz (kostenlos speicherst du bis zu 5 Routen), bleiben die übrigen in deiner Bibliothek unter **On this device** aufgeführt und wandern beim nächsten Anmelden mit genug freiem Platz mit.

## Eine Route entfernen

Klicke auf **Zurücksetzen** (das Papierkorb-Symbol), um die aktuelle Route von der Karte zu leeren. Um eine gespeicherte Route zu löschen, öffne sie aus deiner Bibliothek und nutze ihre Löschaktion.
`,
	},
	{
		path: "routes/route-info.mdx",
		content: `---
title: Routeninfo
description: Distanz, Dauer, Höhe und Untergrund.
translationStatus: machine-draft
---

Die Seitenleiste zeigt Live-Statistiken für deine Route, während du sie aufbaust.

![Die Seitenleiste mit Höhendiagramm, Untergrundaufschlüsselung, Statistik und Wegpunktliste](/guide/route-info.png)

## Gesamtstatistik

Die Statistikzeile sitzt über dem Höhendiagramm:

- **Distanz**: Summe aller Abschnitte, in km oder mi (in deinem Konto eingestellt)
- **Dauer**: geschätzte Reisezeit für die ausgewählte Sportart, als Stunden und Minuten
- **Höhenmeter**: gesamter Anstieg über die ganze Route
- **Geschwindigkeit oder Tempo**: Durchschnittsgeschwindigkeit (km/h oder mph) beim Radfahren, Tempo (min/km oder min/mi) beim Laufen oder Gehen

Jede Wegpunktzeile in der Liste zeigt außerdem die Distanz entlang der Route bis zu diesem Punkt.

## Höhen- und Untergrunddiagramm

Ein einzelnes Diagramm zeigt das Höhenprofil deiner Route, mit dem Untergrundtyp als farbige Bänder darunter. Fahre mit dem Mauszeiger über das Diagramm, und eine Anzeige darunter zeigt Höhe, Distanz und Untergrund an diesem Punkt der Route. Der passende Punkt auf der Karte wird hervorgehoben, während du dich bewegst.

Die Routenlinie auf der Karte nutzt außerdem Strichmuster, um den Untergrund anzudeuten: durchgezogen für befestigt, gestrichelt für unbefestigt, gepunktet für Pfade. Diagramm und Karte teilen sich dieselbe Farbskala, sodass du das eine auf einen Blick dem anderen zuordnen kannst.

## Wie Schätzungen berechnet werden

Die Dauer nutzt dein sportartspezifisches Tempo aus **Einstellungen → Sportarten & Tempo**. Jede Sportart (Gehen, Laufen, Radfahren) hat ihr eigenes Standardtempo; passe das Standardtempo an, wenn es nicht dazu passt, wie schnell du dich tatsächlich bewegst. Die Höhenmeter stammen aus Mapbox Terrain-RGB; der Untergrund kommt aus der Routing-Engine.
`,
	},
	{
		path: "routes/sharing-routes.mdx",
		content: `---
title: Routen teilen
description: Eine Route über einen Link oder native Teilen-Ziele teilen.
translationStatus: machine-draft
---

Klicke auf **Teilen** in der Routen-Seitenleiste, oder öffne eine gespeicherte Route und klicke auf ihre Teilen-Schaltfläche, um das Teilen-Dialogfenster aufzurufen.

![Das Teilen-Dialogfenster mit Kartenvorschau, Teilen-Link, Teilen-Zielen und GPX-Export](/guide/share-modal.jpg)

## Was im Dialogfenster steckt

- **Link kopieren**: kopiert einen Link in deine Zwischenablage. Die Route selbst ist im Link codiert, sodass er immer die Route so wiedergibt, wie sie zum Zeitpunkt des Kopierens war.
- **Natives Teilen**: Auf dem Mobilgerät öffnet das die Teilen-Ansicht deines Telefons (WhatsApp, Nachrichten, Mail usw.).
- **Teilen-Ziele**: Sende die Route direkt an E-Mail, WhatsApp, Facebook oder X.
- **GPX exportieren**: Lade die Route als GPX-Datei herunter, statt einen Link zu teilen.
- **Vorschau**: ein Kartenvorschaubild und die Routenstatistik, damit die Person, der du sie schickst, weiß, was sie bekommt.

## Was die empfangende Person sieht

Wer den Link öffnet, sieht die Route im Planer geladen: den Pfad auf der Karte, die Statistik und das Höhen- und Untergrunddiagramm. Zum Ansehen ist kein Konto nötig, und sie kann die Route als GPX exportieren. Um eine Kopie in ihrer eigenen Bibliothek zu speichern, muss sie sich anmelden.

## Eine Route an eine Person senden

Wenn die empfangende Person bei routess ist, kannst du den Link überspringen und eine gespeicherte Route direkt an ihren Posteingang im Social-Bereich schicken: Wähle **An Person senden**, suche sie über Name oder Handle und füge eine optionale Nachricht hinzu. Siehe [Routen an Personen senden](/de/guide/social/inbox).

## Öffentliche Routenseiten

Gespeicherte Routen, die nicht gelistet oder öffentlich sind, erhalten zusätzlich eine eigenständige Webseite mit Karte, Statistik und einem GPX-Download, auf die auch die Linkvorschauen in Chat-Apps verweisen. Öffentliche Routen können darüber hinaus auf deinem [Profil](/de/guide/social/profiles), in [Entdecken](/de/guide/discover) und in Suchmaschinen erscheinen; nicht gelistete bleiben nur über den Link erreichbar.

## Sichtbarkeit: privat, nicht gelistet, öffentlich

Gespeicherte Routen haben eine Sichtbarkeitseinstellung, die beim Speichern gewählt und später geändert werden kann:

- **Privat**: Nur du siehst sie in deiner Bibliothek.
- **Nicht gelistet**: Wer den Link hat, kann sie ansehen.
- **Öffentlich**: für alle sichtbar.

Du kannst unter **Einstellungen → Routing-Standards → Standardsichtbarkeit** eine Voreinstellung für neue Routen festlegen. Das Teilen eines Links über das Teilen-Dialogfenster ändert die Sichtbarkeit einer Route nicht, da der Link die Routendaten selbst trägt.
`,
	},
	{
		path: "map/navigation.mdx",
		content: `---
title: Kartennavigation
description: Die Karte verschieben, zoomen und drehen.
translationStatus: machine-draft
---

![Die Kartenwerkzeugleiste mit Suche, Rückgängig/Wiederholen, Stil, Sperren und Zoom-Bedienelementen](/guide/map-controls.png)

## Verschieben

Klicke und ziehe, um dich zu bewegen. Auf Touchgeräten ziehst du mit einem Finger.

## Zoomen

- Nach oben scrollen, um hineinzuzoomen, nach unten, um herauszuzoomen
- Doppelklick, um hineinzuzoomen
- Auf Touchgeräten mit zwei Fingern zoomen
- Die Schaltflächen \`+\` / \`-\` in der Kartenwerkzeugleiste nutzen

## Drehen & Neigen

Halte \`Ctrl\` (oder Rechtsklick) und ziehe, um zu drehen. Halte \`Ctrl + Shift\`, um die Karte in eine 3D-Perspektive zu neigen.

## Neu zentrieren

Klicke auf die Schaltfläche **Auf mich zentrieren** in der Kartenwerkzeugleiste, um wieder auf deinen aktuellen Standort zu zentrieren (der Browser fragt beim ersten Mal nach Erlaubnis).

## Suche

Klicke auf **Ort suchen** in der Kartenwerkzeugleiste (oder öffne die Suche über die Befehlspalette) und gib einen Ortsnamen oder eine Adresse ein; das Auswählen eines Ergebnisses springt mit der Karte dorthin. Deine letzten Suchen erscheinen darunter zur schnellen Wiederverwendung. Der Suchverlauf wird nur auf deinem Gerät gespeichert, niemals auf dem Server.
`,
	},
	{
		path: "map/styles.mdx",
		content: `---
title: Kartenstile
description: Zwischen Kartendarstellungen wechseln.
translationStatus: machine-draft
---

routess bietet drei eingebaute Kartenstile. Öffne die Schaltfläche **Kartenstil** in der Kartenwerkzeugleiste, um zu wechseln.

![Der Kartenstil-Umschalter mit Straßen, Outdoor und Satellit](/guide/map-styles.jpg)

## Verfügbare Stile

- **Straßen**: detaillierte Standard-Straßenansicht
- **Outdoor**: Höhenlinien und Wegdetails, nützlich zum Wandern
- **Satellit**: Luftbilder

Der ausgewählte Stil wird über Sitzungen hinweg gemerkt.

Suchst du eine dunkle Karte? Der Dunkelmodus ist ein Design, kein Kartenstil: Schalte ihn über die linke Leiste oder mit \`Ctrl/Cmd + D\` um.
`,
	},
	{
		path: "map/your-location.mdx",
		content: `---
title: Dein Standort
description: Deinen Live-Standort auf der Karte anzeigen.
translationStatus: machine-draft
---

routess kann deinen Standort auf der Karte anzeigen und dir folgen, während du dich bewegst.

![Der blaue Standortpunkt auf der Karte](/guide/your-location.jpg)

## Standort aktivieren

Klicke auf die Schaltfläche **Auf mich zentrieren** in der Kartenwerkzeugleiste. Dein Browser fragt beim ersten Mal nach Erlaubnis; wähle **Erlauben**.

Ein blauer Punkt erscheint auf der Karte an deiner aktuellen Position.

## Datenschutz

Dein Standort bleibt in deinem Browser. routess sendet deinen Live-Standort nicht an seine Server.

## Probleme?

- Stelle sicher, dass dein Browser den Standort für diese Seite verwenden darf
- HTTPS ist erforderlich; Standorte funktionieren nicht über einfaches HTTP
- Manche VPNs und Firmennetzwerke blockieren die Standortbestimmung
`,
	},
	{
		path: "account/profile.mdx",
		content: `---
title: Dein Profil
description: Dein Profil und deine sportartspezifischen Einstellungen ansehen und aktualisieren.
translationStatus: machine-draft
---

Öffne **Einstellungen** über die linke Leiste, um dein Profil und deine Voreinstellungen zu verwalten.

![Das Einstellungsfeld mit Schnelleinstellungen und Bereichen](/guide/settings.jpg)

## Was du bearbeiten kannst

- **Design und Einheiten**: hell oder dunkel, metrisch oder imperial (Schnelleinstellungen oben)
- **Sportarten & Tempo**: für welche Sportarten du planst (Gehen, Laufen, Radfahren) und ein Standardtempo für jede
- **Karte & Anzeige**: Kartenstil, Sprache, Akzentfarbe und Kartenverhalten
- **Datenschutz & Teilen**: Standardsichtbarkeit für neue Routen

Dein Anzeigename befindet sich unter deinem Konto; die E-Mail-Adresse wird aus deiner Anmeldemethode übernommen und kann in routess nicht geändert werden.

## Dein öffentliches Profil

Dein Konto hat außerdem eine öffentliche Profilseite unter \`/u/dein-handle\`, die deine öffentlichen Routen auflistet. Der Handle lässt sich in den Einstellungen ändern; siehe [Profile & Handles](/de/guide/social/profiles).

## Sportarten und Tempo

Wähle unter **Sportarten & Tempo** eine oder mehrere Sportarten aus und markiere eine als Standard für neue Routen. Die aktuell ausgewählte Sportart bestimmt die Dauerschätzungen deiner Routen. Jede Sportart hat ihr eigenes Standardtempo; passe es an, wenn es nicht dazu passt, wie schnell du dich tatsächlich bewegst. Die Änderung wird beim nächsten Neuberechnen der Route wirksam.
`,
	},
	{
		path: "account/language.mdx",
		content: `---
title: Sprache
description: Die App-Sprache ändern.
translationStatus: machine-draft
---

routess ist verfügbar in:

- English
- Nederlands
- Français
- Deutsch

![Die Sprachauswahl unter Einstellungen, Karte & Anzeige](/guide/language.jpg)

Öffne **Einstellungen** über die linke Leiste, dann **Karte & Anzeige**. Die Auswahl **Sprache** befindet sich unter Darstellung. Die Wahl wird beim nächsten Besuch gemerkt.

## Eine Sprache gewünscht, die wir nicht haben?

routess ist quelloffen und Beiträge sind willkommen. Siehe [Entwicklerdocs → Pakete → i18n](/docs/packages/i18n), wie du eine Sprache hinzufügst.
`,
	},
	{
		path: "account/deleting-account.mdx",
		content: `---
title: Konto löschen
description: Lösche dein routess-Konto und alle deine Routen dauerhaft.
translationStatus: machine-draft
---

Du kannst dein routess-Konto jederzeit löschen. Das ist **dauerhaft und unwiderruflich**.

![Die Bestätigung zum Konto löschen im Gefahrenbereich des Kontos](/guide/delete-account.jpg)

## Was gelöscht wird

- Dein Profil
- Alle deine gespeicherten Routen
- Deine Anmeldeverknüpfung mit Google

## So löschst du

1. Öffne das Menü → **Profil**
2. Scrolle zu **Gefahrenbereich**
3. Klicke auf **Konto löschen** und bestätige

> Screenshot-Platzhalter: Bestätigungsdialog zum Löschen des Kontos.

Nach dem Löschen wird durch erneutes Anmelden mit Google ein frisches Konto ohne Verlauf erstellt.
`,
	},
	{
		path: "account/api-tokens.mdx",
		content: `---
title: API-Tokens
description: Tokens für Skripte, Agents und die routess-CLI erstellen.
translationStatus: machine-draft
---

Mit API-Tokens können Skripte und Tools mit deiner Routenbibliothek arbeiten, ohne dein Passwort zu benötigen. Verwalte sie unter **Einstellungen → API-Tokens** (sichtbar, wenn du angemeldet bist).

![Der Bereich API-Tokens unter Einstellungen, Erweitert, mit Tokens und ihren Geltungsbereichen](/guide/api-tokens.jpg)

## Ein Token erstellen

1. Klicke auf **Token erstellen**.
2. Gib ihm ein **Label**, das du später wiedererkennst, z. B. \`Backup-Skript (Laptop)\`.
3. Wähle einen **Geltungsbereich**:
   - **Lesen**: Routen auflisten und ansehen
   - **Schreiben**: Lesen plus Umbenennen, Sichtbarkeit ändern und Löschen
4. Lege optional ein **Ablaufdatum** fest. Leer bedeutet, dass es nie abläuft.

Das Token wird **einmal** angezeigt. Kopiere es und bewahre es an einem sicheren Ort auf; wenn du es verlierst, widerrufe es und erstelle ein neues.

## Verwenden

Sende das Token als Bearer-Token:

\`\`\`sh
curl -H "Authorization: Bearer <dein-token>" https://api.routess.com/api/v1/routes
\`\`\`

Im [API-Referenz](https://docs.routess.com/api) findest du jeden Endpunkt.

## Ein Token widerrufen

Bei jedem Token siehst du, wann es erstellt und zuletzt verwendet wurde. **Widerrufen** schaltet es sofort ab; alles, was es noch verwendet, hört auf zu funktionieren.

Rotiere Tokens, die du nicht mehr wiedererkennst, und bevorzuge ein Token pro Tool, damit das Widerrufen eines Tokens die anderen nicht beeinträchtigt.
`,
	},
	{
		path: "account/security.mdx",
		content: `---
title: Kontosicherheit
description: Passwörter, Sitzungen und überall abmelden.
translationStatus: machine-draft
---

Öffne deine Kontoseite über den Avatar am unteren Ende der linken Leiste.

![Die Kontoseite mit Passwort, Sitzungen und Überall-abmelden](/guide/account-security.jpg)

## Passwort

Wenn du dich mit Google registriert hast, kannst du trotzdem ein **Passwort festlegen**, sodass E-Mail + Passwort als zweiter Anmeldeweg funktioniert. Hast du bereits eines, kannst du es an derselben Stelle **ändern**. Passwörter müssen mindestens 12 Zeichen lang sein.

Vergessen? Nutze **Passwort vergessen?** auf dem Anmeldebildschirm; der Link zum Zurücksetzen kommt per E-Mail.

## Sitzungen

Der Abschnitt **Sitzungen** zeigt dieses Gerät. Das Abmelden über das Menü beendet nur die aktuelle Sitzung.

## Auf allen Geräten abmelden

Unter **Sicherheit** widerruft **Auf allen Geräten abmelden** jede aktive Sitzung, einschließlich der, die du gerade verwendest. Nutze es, wenn du dich an einem gemeinsam genutzten Computer angemeldet hast oder vermutest, dass jemand anderes Zugriff hat. Danach musst du dich erneut anmelden.

Für skriptgesteuerten oder Drittanbieter-Zugriff auf deine Bibliothek verwende [API-Tokens](/de/guide/account/api-tokens) statt deines Passworts.
`,
	},
	{
		path: "discover.mdx",
		content: `---
title: Entdecken
description: Durchstöbere öffentliche Routen aus der Community auf der Karte.
translationStatus: machine-draft
---

**Entdecken** zeigt öffentliche Routen aus der Community für den Kartenausschnitt, den du dir gerade ansiehst. Öffne es über die linke Leiste (oder die untere Tableiste auf dem Handy). Das Stöbern funktioniert ohne Konto.

![Entdecken mit Community-Routenkarten für den sichtbaren Kartenausschnitt](/guide/discover.jpg)

## Die Karte ist die Suche

Verschiebe oder zoome irgendwohin, und die Liste aktualisiert sich auf die Routen im Sichtfeld, die neuesten zuerst, bis zu 50 auf einmal. Es gibt keine Such-Schaltfläche: Das Bewegen der Karte ist die Suchanfrage.

Zwei Filter grenzen die Liste ein:

- **Aktivität**: Alle, Radfahren, Laufen oder Gehen
- **Distanz**: beliebige Distanz oder ein Bereich (unter 5 km, 5 bis 15 km, 15 bis 50 km, über 50 km)

Ein Zähler zeigt, wie viele Routen sich im Sichtfeld befinden.

## Routenkarten

Jedes Ergebnis zeigt den Namen der Route, die Aktivität, die Distanz, die Höhenmeter, ein Kartenvorschaubild, die Autorin oder den Autor und wo die Route startet (Ort und Region, automatisch aus dem Startpunkt abgeleitet). Wenn du auf dem Desktop mit dem Mauszeiger über eine Karte fährst, wird diese Route auf der Karte hervorgehoben.

Ein Klick auf eine Karte öffnet die [öffentliche Seite](/de/guide/routes/sharing-routes) der Route mit der vollständigen Karte, der Statistik und einem GPX-Download. Melde dich dort an, um eine Kopie in deiner eigenen Bibliothek zu speichern.

## Deine Routen in Entdecken bringen

Entdecken listet Routen, deren Sichtbarkeit **öffentlich** ist. Mache eine Route in ihrem Detailbereich in deiner [Bibliothek](/de/guide/library/your-library) öffentlich, und sie taucht für alle auf, die sich diesen Bereich ansehen. Wie Sichtbarkeit funktioniert, erfährst du unter [Routen teilen](/de/guide/routes/sharing-routes); nicht gelistete Routen bleiben aus Entdecken heraus.
`,
	},
	{
		path: "getting-started/onboarding.mdx",
		content: `---
title: Ersteinrichtung
description: Was der Willkommensbildschirm fragt und warum.
translationStatus: machine-draft
---

![Der Willkommensbildschirm von routess](/guide/welcome.jpg)

Wenn du routess zum ersten Mal öffnest, führt es dich durch eine kurze Einrichtung. Jede Antwort kannst du später in den **Einstellungen** ändern.

1. **Wähle deine Standard-Sportart(en)**: Gehen, Laufen oder Radfahren. Die Standard-Sportart bestimmt neue Routen.
2. **Wähle deine Einheiten**: metrisch oder imperial, angewendet auf jede Distanz, Höhe und jedes Tempo, das du siehst.
3. **Dein durchschnittliches Tempo**: eine typische Geschwindigkeit pro Sportart, die zur Schätzung von Routendauern verwendet wird.
4. **Wähle deinen Kartenstil**: Straßen, Outdoor oder Satellit (siehe [Kartenstile](/de/guide/map/styles)).
5. **Standortzugriff erlauben?**: optional; wird verwendet, um die Karte auf dich zu zentrieren. Siehe [Dein Standort](/de/guide/map/your-location).

Du kannst dich sofort anmelden oder **ohne Konto fortfahren**; Planen und [Speichern](/de/guide/routes/saving-routes) funktionieren in beiden Fällen, und auf dem Gerät gespeicherte Routen wandern in dein Konto, sobald du dich anmeldest.
`,
	},
	{
		path: "library/collections.mdx",
		content: `---
title: Sammlungen
description: Routen zu Reisen, Trainingsblöcken oder Wunschlisten gruppieren.
translationStatus: machine-draft
---

Sammlungen gruppieren gespeicherte Routen in geordnete Listen: ein Radurlaub, ein Trainingsblock, eine "Will ich fahren"-Wunschliste. Eine Route kann in beliebig vielen Sammlungen sein, und eine Sammlung verweist nur auf Routen, sodass das Entfernen einer Route aus einer Sammlung nie die Route selbst löscht.

![Der Sammlungen-Reiter mit Sammlungen und ihrer Routenanzahl](/guide/collections.jpg)

## Eine Sammlung erstellen

Öffne den Reiter **Sammlungen** in deiner Bibliothek und klicke auf **Neue Sammlung**. Gib einen Namen ein und drücke Enter.

## Routen hinzufügen und anordnen

Öffne eine Sammlung und nutze **Routen hinzufügen**, um aus deiner Bibliothek auszuwählen, oder nutze **Zur Sammlung hinzufügen** im Menü einer Routenkarte im Reiter Routen. Ziehe den Ziehgriff einer Zeile, um umzusortieren; auf dem Handy halte den Griff gedrückt und ziehe dann.

## Eine Sammlung teilen

Nutze die Teilen-Aktion der Sammlung, um einen Link zu kopieren. Das Teilen macht die Sammlung **nicht gelistet**: Wer den Link hat, kann sie ansehen, auch Personen ohne Konto, aber sie ist nirgendwo öffentlich gelistet. Der Link zeigt die Routen der Sammlung; private Routen darin bleiben für andere verborgen.

## Eine Sammlung löschen

Nutze die Löschaktion und klicke erneut zum Bestätigen. Die Routen darin bleiben in deiner Bibliothek.
`,
	},
	{
		path: "library/route-details.mdx",
		content: `---
title: Routendetails
description: Der Detailbereich einer gespeicherten Route, vom Umbenennen bis zum GPX-Export.
translationStatus: machine-draft
---

Klicke eine Karte in deiner [Bibliothek](/de/guide/library/your-library) an, um den Detailbereich der Route zu öffnen. Die Kartenvorschau bleibt dahinter, sodass du die Route siehst, während du arbeitest.

![Der Detailbereich einer gespeicherten Route mit Statistiken, Höhenprofil, Eigenschaften und Aktionen](/guide/route-details.jpg)

## Oben

- **Name**: Klicke den Titel an, um ihn direkt umzubenennen.
- **Statistikleiste**: Distanz, Dauer, Höhenmeter und Durchschnittsgeschwindigkeit (Radfahren) oder Tempo (Laufen und Gehen).
- **Höhendiagramm**: dasselbe Höhenprofil und dieselbe Untergrundaufschlüsselung wie im Planer.
- Die Kopfzeile enthält außerdem **Favorit** und **Als Kopie speichern** (duplizieren).

## Eigenschaften

- **Aktivität**: Laufen, Radfahren oder Gehen; ein Wechsel schätzt die Dauer neu.
- **Sichtbarkeit**: privat, nicht gelistet oder öffentlich. Was jede bedeutet, steht unter [Routen teilen](/de/guide/routes/sharing-routes).
- **Tags**: Tags hinzufügen oder entfernen; sie steuern den Tag-Filter der Bibliothek.

## Aktionen in der Fußzeile

- **Route bearbeiten**: die Route im Planer öffnen, um Wegpunkte zu ändern.
- **Teilen**: Links, an eine Person senden und Social-Ziele.
- **GPX herunterladen**: die Route als GPX-Datei exportieren.
- **Löschen**: entfernt die Route dauerhaft.

Wegpunkte werden immer im Planer geändert; alles andere an einer Route lässt sich direkt hier bearbeiten.
`,
	},
	{
		path: "library/your-library.mdx",
		content: `---
title: Deine Bibliothek
description: Deine gespeicherten Routen durchsuchen, filtern und sortieren.
translationStatus: machine-draft
---

Öffne **Bibliothek** über die linke Leiste (oder die untere Tab-Leiste auf dem Handy), um alles zu sehen, was du gespeichert hast. Abgemeldet listet die Bibliothek die [auf diesem Gerät gespeicherten Routen](/de/guide/routes/saving-routes#was-wenn-ich-nicht-angemeldet-bin) auf oder zeigt eine Anmeldeaufforderung, solange es noch keine gibt.

![Der Routen-Reiter der Bibliothek mit Routenkarten, Aktivitäts-Chips und Filtern](/guide/library.jpg)

Der Bereich hat zwei Reiter: **Routen** für einzelne Routen und **[Sammlungen](/de/guide/library/collections)** zum Gruppieren.

## Routenkarten

Jede gespeicherte Route ist eine Karte mit Kartenvorschau, Namen, Aktivität und den wichtigsten Statistiken. Klicke eine Karte an, um ihre [Details](/de/guide/library/route-details) zu öffnen. Das Herz auf der Karte schaltet **Favorit** um, und Löschen sitzt direkt daneben. Das Kartenmenü enthält den Rest:

- **Im Planer bearbeiten**: die Route in den Planen-Bereich laden, um Wegpunkte zu bearbeiten
- **Umbenennen**
- **Zur Sammlung hinzufügen**
- **Tags bearbeiten**
- **GPX exportieren**

## Suche und Filter

- **Suche** findet Routennamen beim Tippen.
- **Aktivitäts-Chips** grenzen auf Radfahren, Laufen oder Gehen ein; der Herz-Chip zeigt nur Favoriten.
- **Filter** ergänzt Distanzbereiche (kurz bis episch), Sichtbarkeit (privat, nicht gelistet, öffentlich) und Tags.
- **Sortieren** ordnet nach zuletzt aktualisiert, Name, Distanz oder Höhenmetern.

## Tags

Tags sind frei wählbare Labels (bis zu 10 pro Route) und das wichtigste Ordnungswerkzeug der Bibliothek: \`pendeln\`, \`gravel\`, \`urlaub-2026\`, was immer du magst. Füge sie über das Kartenmenü oder den Detailbereich der Route hinzu und filtere dann im Menü **Filter** danach.

## Von vorn beginnen

Eine leere Bibliothek bietet die drei Wege an, eine erste Route hineinzubekommen: **Route planen**, **Rundstrecke generieren** oder **GPX importieren**.
`,
	},
	{
		path: "map/display-options.mdx",
		content: `---
title: Anzeigeoptionen
description: Karten- und Anzeigeeinstellungen, die verändern, was du siehst.
translationStatus: machine-draft
---

Öffne **Einstellungen** über die linke Leiste und scrolle zu **Karte & Anzeige**.

![Die Karten- und Anzeigeeinstellungen](/guide/map-display.jpg)

## Kartenverhalten

- **Kartenstil**: Straßen, Outdoor oder Satellit (siehe [Kartenstile](/de/guide/map/styles))
- **Automatisch auf Straßen einrasten**: Wegpunkte, die du setzt oder ziehst, rasten auf der nächstgelegenen Straße ein
- **Hilfslinie bei Abweichung**: zeigt eine gestrichelte Linie zum nächstgelegenen Punkt deiner Route, wenn du von ihr abweichst
- **Blickrichtungskegel**: zeichnet einen Kegel auf deine Standortmarkierung, der in die Richtung zeigt, in die du blickst

## Erscheinungsbild

- **Design**: hell oder dunkel, auch umschaltbar mit \`Ctrl/Cmd + D\`
- **Akzentfarbe**: Violett, Kobalt, Wald oder Glut

## Experimentell

Unter **Erweitert** findest du experimentelle Schalter:

- **Knotenpunkt-Netzwerk-Overlays**: zeigt nummerierte Rad- und Wander-Knotenpunktnetze auf der Karte. Verbreitet in Belgien und den Niederlanden; nützlich für die Planung von Knotenpunkt-zu-Knotenpunkt-Touren.

Experimentelle Funktionen können sich zwischen Releases ändern oder verschwinden.
`,
	},
	{
		path: "mobile.mdx",
		content: `---
title: routess auf deinem Handy
description: Wie die Oberfläche auf kleinen Bildschirmen funktioniert.
translationStatus: machine-draft
---

Auf dem Handy bleibt die Karte im Vollbild, und die Seitenleiste vom Desktop wird zu einem unteren Ausziehbereich.

![Der Planer auf einem Handy mit der unteren Tab-Leiste](/guide/mobile-planner.jpg)

## Obere Leiste

Die Leiste oben enthält Suche, Benachrichtigungen, den Umschalter für den Dunkelmodus und dein Konto.

## Untere Tab-Leiste

Die Tabs am unteren Rand wechseln zwischen **Planen**, **Bibliothek**, **Entdecken**, **Social** und **Einstellungen**, denselben Bereichen wie die linke Leiste auf dem Desktop. Tippe erneut auf den aktiven Tab, um seinen Ausziehbereich einzuklappen und die ganze Karte zurückzubekommen.

## Der untere Ausziehbereich

Bereiche öffnen sich als Ausziehbereich über der Karte. Ziehe ihn nach oben für den vollständigen Bereich (Wegpunkte, Höhenprofil, Statistiken) oder nach unten, um nur einen Blick darauf zu behalten, während die Karte den Bildschirm einnimmt.

![Der Planen-Bereich, geöffnet als unterer Ausziehbereich](/guide/mobile-drawer.jpg)

## Gesten zum Bearbeiten

Das Bearbeiten von Routen auf Touchscreens hat seine eigene Gesten-Grammatik, gebaut, damit die Karte nie einen Wegpunkt greift, den du nicht berühren wolltest:

- **Auf leere Karte tippen**: einen Wegpunkt hinzufügen
- **Auf einen Wegpunkt tippen**: sein Popup öffnen, mit Löschen
- **Wegpunkt lang gedrückt halten**: ihn anheben (der Marker wird größer), dann an eine neue Stelle ziehen
- **Routenlinie lang gedrückt halten**: dort einen neuen Wegpunkt einfügen und sofort ziehen
- **Leere Karte lang gedrückt halten**: einen direkten Wegpunkt (Luftlinie) hinzufügen
- **Einen angehobenen Wegpunkt in die Papierkorb-Zone ziehen** am unteren Rand der Karte, um ihn zu löschen

Wenn du deinen Finger sofort bewegst, verschiebst du immer die Karte; **spreizen** zoomt und eine **Zwei-Finger-Drehung** rotiert. Um Wegpunkte im Planen-Ausziehbereich umzusortieren, halte den Ziehgriff einer Zeile gedrückt und ziehe dann.

Wie du routess unterwegs auf dem Weg mit einer instabilen Verbindung nutzt, erfährst du unter [Offline & die App installieren](/de/guide/offline).
`,
	},
	{
		path: "offline.mdx",
		content: `---
title: Offline & die App installieren
description: routess als App installieren und mit schlechter Verbindung nutzen.
translationStatus: machine-draft
---

routess ist eine Progressive Web App (PWA): Du kannst sie aus dem Browser installieren, und sie funktioniert weiter, wenn deine Verbindung abbricht, also genau dann, wenn du unterwegs auf einem Weg bist.

## Installieren

Am einfachsten geht es direkt in routess: Öffne **Einstellungen** und nutze **App installieren**. In den meisten Browsern löst das direkt die Installationsaufforderung aus; unter iOS führt es dich durch die Schritte **Teilen → Zum Home-Bildschirm** in Safari.

Die Installation aus dem Browser selbst funktioniert ebenfalls:

- **Chrome / Edge (Desktop und Android)**: öffne das Browsermenü und wähle **App installieren** (oder **Zum Startbildschirm hinzufügen**).
- **Safari (iOS)**: tippe auf **Teilen** und dann auf **Zum Home-Bildschirm**.

Die installierte App öffnet sich in einem eigenen Fenster, ohne Browser-Rahmen.

## Was offline funktioniert

Nach deinem ersten Besuch speichert routess im Cache:

- die App selbst, sodass sie auch ohne Verbindung sofort lädt
- Kartenkacheln, -stile und Schriftarten, die du bereits angesehen hast
- aktuelle Routenberechnungen und Ortssuchen

Gebiete, in denen du zuvor geplant hast, bleiben durchsuchbar, und Routen, die du geöffnet hast, bleiben über App-Updates hinweg offline verfügbar. Alles Neue (nicht besuchte Kartengebiete, frische Routenberechnungen, Speichern in deiner Bibliothek) benötigt eine Verbindung; wenn ein Speichervorgang den Server nicht erreichen kann, sagt routess dir das, statt so zu tun, als hätte es geklappt.

## Updates

Die App aktualisiert sich im Hintergrund selbst. Wenn eine neue Version bereitsteht, bietet ein Hinweis **Neu laden** an; das Update wird angewendet, wenn du bestätigst oder beim nächsten Neustart, nie mitten in der Bearbeitung.
`,
	},
	{
		path: "routes/generating-loops.mdx",
		content: `---
title: Rundstrecken generieren
description: Generiere Vorschläge für Rundstrecken aus einem Startpunkt und einer Distanz.
translationStatus: machine-draft
---

Keine Idee, wohin? **Rundstrecke generieren** baut Rundtouren für dich: von deinem Startpunkt zurück zu deinem Startpunkt. Es funktioniert ohne Konto.

![Der Dialog Rundstrecke generieren mit Startpunkt, Distanz, Richtung und Belag](/guide/generate-loop.jpg)

## Generieren

1. Klicke auf die Kompass-Schaltfläche in der Kartenwerkzeugleiste.
2. Wähle einen Startpunkt: **Kartenmitte**, **Mein Standort** oder **Auf Karte wählen**.
3. Stelle die **Zieldistanz** mit dem Schieberegler ein (1 bis 100 km).
4. Beeinflusse optional die **Richtung** (Beliebig, Nord, Ost, Süd, West) und den **Untergrund** (Gemischt, Befestigt, Unbefestigt).
5. Klicke auf **Generieren**.

Rundstrecken werden für die Aktivität generiert, die du ausgewählt hast (Laufen, Radfahren, Gehen), und folgen deinen [Routing-Voreinstellungen](/de/guide/routes/routing-preferences).

## Eine Rundstrecke wählen

Nach kurzer Zeit erscheinen bis zu drei Rundstrecken auf der Karte, jede mit einer Karte, die Distanz, Dauer, Höhenmeter und die Untergrundaufschlüsselung zeigt. Eine Rundstrecke, die größtenteils dieselben Wege erneut nutzt, erhält auf ihrer Karte eine Warnung zu "wiederholten Wegen".

- Klicke auf eine Karte oder eine abgeblendete Rundstrecke auf der Karte, um sie in der Vorschau zu sehen.
- **Diese Route verwenden** lädt die Rundstrecke in den Planer, wo du sie wie jede andere Route [bearbeiten](/de/guide/routes/editing-routes) und [speichern](/de/guide/routes/saving-routes) kannst.
- **Andere Rundstrecken zeigen** generiert neu, mit Formen in Richtungen, die du noch nicht gesehen hast.

## Wenn nichts zurückkommt

Manche Orte lassen sich einfach schlecht als Rundstrecke planen. Wenn die Generierung fehlschlägt, sagt routess, warum, und bietet Lösungen mit einem Klick: eine beliebige Richtung probieren, eine kürzere Distanz probieren oder von vorn beginnen. Wenn der Startpunkt nicht in der Nähe einer Straße oder eines Wegs liegt, verschiebe ihn näher heran und generiere erneut.
`,
	},
	{
		path: "routes/importing-routes.mdx",
		content: `---
title: Routen importieren
description: Bestehende GPX-Dateien in routess bringen.
translationStatus: machine-draft
---

Öffne **Route importieren** über die Planen-Seitenleiste, die Bibliothek oder die Befehlspalette (\`Ctrl/Cmd + K\`).

![Der Importdialog](/guide/import-route.jpg)

## So funktioniert es

1. Ziehe eine Datei auf das Dialogfenster oder klicke auf **Datei auswählen**.
2. Wähle, wohin sie geht: **Im Planer öffnen**, um sie zuerst auf der Karte zu prüfen und zu bearbeiten, oder **In Bibliothek speichern**, um sie direkt als gespeicherte Route abzulegen. Abgemeldet speichert **In Bibliothek speichern** die Route auf diesem Gerät; sie wandert in dein Konto, sobald du dich anmeldest.
3. routess liest den Track und erkennt den Aktivitätstyp, oder du wählst ihn selbst aus.

Routen, die direkt in der Bibliothek gespeichert werden, übernehmen ihren Namen aus den Metadaten der GPX-Datei und greifen ersatzweise auf den Dateinamen zurück.

## Unterstützte Formate

**GPX** wird derzeit unterstützt, bis zu 25 MB. TCX, FIT und KML sind geplant; die Auswahl eines dieser Formate zeigt bis dahin einen Hinweis.

GPX-Exporte aus anderen Apps (Strava, Komoot, Garmin Connect usw.) lassen sich problemlos importieren. Umgekehrt funktioniert es ebenfalls: Jede Route in routess kann [als GPX exportiert werden](/de/guide/routes/sharing-routes).
`,
	},
	{
		path: "routes/routing-preferences.mdx",
		content: `---
title: Routing-Voreinstellungen
description: Untergrund- und Vermeidungsoptionen, die bestimmen, wie routess dich routet.
translationStatus: machine-draft
---

Öffne **Routing-Voreinstellungen** über das Schieberegler-Symbol oben in der Planen-Seitenleiste oder über die Befehlspalette (\`Ctrl/Cmd + K\`). Voreinstellungen werden auf deinem Gerät gespeichert und angewendet, wenn du auf **Anwenden** klickst.

![Der Dialog mit den Routing-Voreinstellungen](/guide/routing-preferences.jpg)

## Untergrund-Voreinstellung

Lenke die Route in Richtung eines Untergrundtyps:

- **Befestigt**: bleibt auf asphaltierten Straßen, ideal für Rennräder
- **Gemischt**: die Standardeinstellung; nimmt, was am besten verbindet
- **Unbefestigt**: bevorzugt Gravel und Wege

Wenn eine berechnete Route deine Voreinstellung nicht einhalten kann, zeigt die Routen-Info eine Warnung zum abweichenden Untergrund, damit du es weißt, bevor du losfährst.

## Vermeidungen

- **Autobahnen vermeiden**: schließt Autobahnsegmente vom Routing aus
- **Fähren vermeiden**: überspringt Routen, die Wasser per Fähre überqueren

**Zurücksetzen** stellt die Standardwerte wieder her. Nach **Anwenden** verwenden neue Routen und Neuberechnungen deine Einstellungen; bestehende Abschnitte ändern sich erst, wenn du sie bearbeitest.
`,
	},
	{
		path: "social/follow-and-feed.mdx",
		content: `---
title: Folgen & Feed
description: Anderen Personen folgen und ihre neu veröffentlichten Routen sehen.
translationStatus: machine-draft
---

Öffne **Social** über die linke Leiste (oder die untere Tab-Leiste). Es hat drei Reiter: **Feed**, **Posteingang** und **Folge ich**. Alle benötigen ein Konto.

![Der Social-Feed mit Routen, die von Personen veröffentlicht wurden, denen du folgst](/guide/feed.jpg)

## Jemandem folgen

Suche im Reiter **Folge ich** Personen über Name oder Handle und klicke auf **Folgen**. Folgen ist einseitig und sofort wirksam: kein Genehmigungsschritt, und die Person muss dir nicht zurückfolgen. Entfolge jederzeit über denselben Reiter oder über ihr Profil.

## Der Feed

Der Reiter **Feed** listet Routen auf, die von den Personen veröffentlicht wurden, denen du folgst, die neuesten zuerst. Eine Route gelangt in den Feed, wenn sie zum ersten Mal **öffentlich** wird; das Hin- und Herschalten der Sichtbarkeit veröffentlicht sie nicht erneut, sodass niemand den Feed zuspammen kann.

Von einem Feed-Eintrag aus kannst du die Route öffnen oder zum Profil der veröffentlichenden Person springen.

## Was Folgen nicht bewirkt

Jemandem zu folgen gewährt nie Zugriff auf seine Routen: Du siehst genau die Routen, die jeder Besucher seines Profils sieht, die öffentlichen. Um eine bestimmte Route an eine bestimmte Person zu geben, nutze stattdessen den [Posteingang](/de/guide/social/inbox).
`,
	},
	{
		path: "social/inbox.mdx",
		content: `---
title: Routen an Personen senden
description: Eine Route direkt mit einer anderen routess-Nutzerin oder einem anderen routess-Nutzer teilen.
translationStatus: machine-draft
---

Neben [Teilen-Links](/de/guide/routes/sharing-routes) kannst du eine gespeicherte Route direkt an eine andere Person auf routess senden. Sie landet in ihrem **Posteingang** im Social-Bereich.

![Der Social-Posteingang mit einer Route, die dir jemand gesendet hat, samt Speichern- und Lese-Aktionen](/guide/inbox.jpg)

## Eine Route senden

1. Öffne die Teilen-Optionen der Route (über den Planen-Bereich oder den Detailbereich der Route).
2. Wähle **An Person senden** und suche die empfangende Person über Name oder Handle.
3. Füge optional eine kurze Nachricht hinzu.
4. Senden.

Nur nicht gelistete und öffentliche Routen können gesendet werden. Wenn die Route privat ist, sagt routess das und bietet **Nicht gelistet machen & senden** an, was die Sichtbarkeit im selben Schritt umstellt.

## Dein Posteingang

Der Reiter **Posteingang** zeigt Routen, die dir Personen geschickt haben, mit einem Ungelesen-Hinweis auf dem Social-Symbol. Für jeden Eintrag kannst du:

- die Route auf der Karte **ansehen**
- **eine Kopie speichern** in deiner eigenen Bibliothek; deine Kopie ist privat und ganz dir
- ihn als gelesen markieren oder entfernen

Ein Posteingangs-Eintrag ist ein Live-Verweis, kein Schnappschuss: Wenn die sendende Person die Route später auf privat stellt oder löscht, lässt sich der Eintrag nicht mehr ansehen. Speichere eine Kopie, wenn du sie dauerhaft behalten möchtest.
`,
	},
	{
		path: "social/notifications.mdx",
		content: `---
title: Benachrichtigungen
description: Die Benachrichtigungsglocke sammelt neue Follower und geteilte Routen.
translationStatus: machine-draft
---

Die Benachrichtigungsglocke sitzt am unteren Ende der linken Leiste (Desktop) oder in der oberen Leiste (Handy) und sammelt, was rund um dein Konto passiert ist. Sie erscheint nur, wenn du angemeldet bist.

![Das Benachrichtigungscenter mit Einträgen für neue Follower und geteilte Routen](/guide/notifications.jpg)

## Was dort landet

- **Neue Follower**: Jemand hat begonnen, [dir zu folgen](/de/guide/social/follow-and-feed). Ein Klick öffnet das Profil dieser Person.
- **Geteilte Routen**: Jemand hat eine Route an deinen [Posteingang](/de/guide/social/inbox) gesendet. Ein Klick öffnet den Posteingang.

Benachrichtigungen werden aus dem Live-Zustand abgeleitet: Wenn dir jemand entfolgt oder eine geteilte Route zurückgezogen wird, verschwindet ihre Benachrichtigung mit ihr.

## Das Ungelesen-Abzeichen

Die Glocke zeigt ein Abzeichen mit der Anzahl der Benachrichtigungen, seit du den Bereich zuletzt geöffnet hast. Das Öffnen des Bereichs setzt das Abzeichen zurück; Einträge, die seit deinem letzten Besuch neu sind, behalten einen blauen Punkt, solange der Bereich geöffnet ist.

Das Abzeichen ist unabhängig vom Gelesen-Status pro Route im Posteingang: Das Öffnen der Glocke markiert geteilte Routen nie als gelesen.

Benachrichtigungen gibt es nur in der App; routess sendet keine Benachrichtigungs-E-Mails oder Push-Nachrichten.
`,
	},
	{
		path: "social/profiles.mdx",
		content: `---
title: Profile & Handles
description: Deine öffentliche Profilseite und der Handle, der sie benennt.
translationStatus: machine-draft
---

Jedes routess-Konto hat ein **Profil**: eine öffentliche Seite, die deinen Namen, deinen Avatar und **nur deine öffentlichen Routen** zeigt. Private und nicht gelistete Routen erscheinen nie darauf, egal wer hinsieht.

![Eine öffentliche Profilseite mit Statistiken, Followerzahlen und öffentlichen Routen](/guide/profile.jpg)

## Dein Handle

Dein Handle ist dein eindeutiger Name auf routess, der bei der Einführung der Funktion aus deinem Anzeigenamen generiert wurde (nie aus deiner E-Mail-Adresse). Er besteht aus Kleinbuchstaben, Ziffern und Bindestrichen, 3 bis 30 Zeichen.

Dein Profil liegt unter \`app.routess.com/u/dein-handle\`. Du kannst den Handle in den **Einstellungen** ändern; beachte, dass Links zum alten Handle dann nicht mehr funktionieren und der freigewordene Handle für andere verfügbar wird.

## Was auf einem Profil steht

- Name, Handle und Avatar
- Statistiken, die über öffentliche Routen berechnet werden: Anzahl der Routen, Gesamtdistanz
- Anzahl der Follower und der gefolgten Personen
- Die Liste der öffentlichen Routen

Jeder kann ein Profil ansehen, angemeldet oder nicht. Die **Anzahl** der Follower ist öffentlich; die tatsächliche Liste, wer wem folgt, ist nur für dich auf deinem eigenen Profil sichtbar.

## Dein Profil teilen

Sende einfach die URL. Um Routen darauf zu bekommen, stelle ihre Sichtbarkeit in den [Routendetails](/de/guide/library/route-details) auf **öffentlich**.

Weiter: [Folgen & Feed](/de/guide/social/follow-and-feed).
`,
	},
];
