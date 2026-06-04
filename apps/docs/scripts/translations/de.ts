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
- Routen in deinem Konto speichern, sodass sie Seitenaktualisierungen und Gerätewechsel überdauern
- Die App auf Englisch, Niederländisch, Französisch oder Deutsch umstellen

## Wie dieses Handbuch aufgebaut ist

- **[Erste Schritte](/de/guide/getting-started/sign-in)**: Anmelden und in 3 Minuten deine erste Route planen
- **[Routen](/de/guide/routes/creating-routes)**: Routen erstellen, bearbeiten, speichern und teilen
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

Ja. routess ist quelloffen und selbst gehostet. Die gehostete Version unter routess.com ist ebenfalls kostenlos.

## Brauche ich ein Konto?

Du kannst eine Route auch ohne Anmeldung planen, aber Routen, die du im abgemeldeten Zustand speicherst, bleiben nur in deinem Browser. Melde dich an, um sie über Sitzungen und Geräte hinweg zu behalten.

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

routess ist quelloffen und so gebaut, dass deine Daten dir gehören. Die vollständige Datenschutzerklärung findest du unter [routess.com/privacy](https://routess.com/privacy); diese Seite ist die Kurzfassung für App-Nutzende.

## Was routess speichert

- Deinen Namen und deine E-Mail-Adresse (aus der Google-Anmeldung oder der E-Mail-Registrierung)
- Deine gespeicherten Routen (Wegpunkte und Metadaten wie Name, Aktivität und Sichtbarkeit)

## Analyse

routess nutzt Umami, ein datenschutzfreundliches, cookieloses Analysewerkzeug, selbst gehostet auf der routess-Infrastruktur. Nutzungsereignisse sind anonym: Sie enthalten niemals deine E-Mail-Adresse, deine Routennamen oder deine rohe Konto-ID. Es gibt keine Tracker von Drittanbietern und keine Werbeprofile.

## Deine Kontrollmöglichkeiten

- **Export**: Lade eine vollständige Kopie deines Kontos (JSON + GPX pro Route) aus deinen Profileinstellungen herunter.
- **Sichtbarkeit**: Jede Route ist standardmäßig privat. Du entscheidest pro Route, ob sie privat, nicht gelistet oder öffentlich ist.
- **Löschen**: Beim Löschen deines Kontos werden deine Routen und dein Profil nach einer 30-tägigen Kulanzfrist entfernt. Siehe [Konto löschen](/de/guide/account/deleting-account).

## Selbst hosten

Wenn du deine eigene routess-Instanz betreibst, bleiben deine Daten auf deiner Infrastruktur. Es ist kein Nachhausetelefonieren eingebaut.
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
- **Bibliothek**: deine gespeicherten Routen
- **Entdecken** und **Social**: geteilte und Community-Routen
- **Einstellungen**: Sportarten, Einheiten, Sprache, Karten- und Datenschutzoptionen

Am unteren Ende der Leiste: Benachrichtigungen, der Umschalter für den Dunkelmodus und dein Konto.

## Die Planen-Seitenleiste

Zeigt deine aktuelle Route: die Aktivitätsreiter (Laufen, Radfahren, Gehen), jeden Wegpunkt, das Höhen- und Untergrunddiagramm sowie die Gesamtstatistik der Route. Klicke einen Wegpunkt an, um die Karte darauf zu fokussieren. Die Schaltflächen **Speichern**, Teilen und Exportieren befinden sich am unteren Ende.

## Die Kartenwerkzeugleiste

Über die Oberseite der Karte:

- **Suche**: einen Ort finden und die Karte dorthin springen lassen
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

Weiter geht es mit [Routen bearbeiten](/de/guide/routes/editing-routes).
`,
	},
	{
		path: "routes/editing-routes.mdx",
		content: `---
title: Routen bearbeiten
description: Ziehen, umsortieren, löschen, rückgängig machen, wiederholen und Metadaten gespeicherter Routen bearbeiten.
translationStatus: machine-draft
---

![Die Wegpunktliste in der Seitenleiste mit Ziehgriffen](/guide/editing-routes.png)

## Umsortieren

Ziehe einen Wegpunkt-Marker auf der Karte. Die Route aktualisiert sich, sobald du loslässt.

## Löschen

Rechtsklick (oder langes Drücken) auf einen Wegpunkt, um ihn zu entfernen. Die Route wird um die Lücke herum neu berechnet.

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

Klicke auf **Speichern** in der Seitenleiste, um die Route mit einem Namen und einer Sichtbarkeit (privat, nicht gelistet oder öffentlich) in deiner Bibliothek abzulegen. Gespeicherte Routen werden in deinem Konto abgelegt und über Geräte hinweg synchronisiert. Zum Speichern ist ein Konto nötig; wenn du abgemeldet bist, bittet routess dich zuerst, dich anzumelden.

## Was, wenn ich nicht angemeldet bin?

Deine laufende Route bleibt nur in deinem Browser. Sie übersteht Seitenaktualisierungen, folgt dir aber nicht auf ein anderes Gerät und kann verloren gehen, wenn du die Browserdaten löschst. Melde dich an und speichere, um sie zu behalten.

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

- **Distanz**: Summe aller Abschnitte, in km oder mi (in deinem Konto eingestellt)
- **Dauer**: geschätzte Reisezeit für die ausgewählte Sportart
- **Höhenmeter**: gesamter Anstieg über die ganze Route

## Statistik pro Abschnitt

Klicke einen Wegpunkt in der Seitenleiste an, um ihn aufzuklappen. Du siehst die Distanz und Dauer des Abschnitts, der zu diesem Wegpunkt führt.

## Höhen- und Untergrunddiagramm

Unter der Statistik zeigt ein einzelnes Diagramm das Höhenprofil deiner Route, mit dem Untergrundtyp als farbige Bänder darunter. Fahre mit dem Mauszeiger über das Diagramm, um Höhe, Distanz und Untergrund an diesem Punkt der Route zu sehen. Der passende Punkt auf der Karte wird hervorgehoben, während du dich bewegst.

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
];
