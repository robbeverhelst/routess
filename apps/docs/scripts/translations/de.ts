import type { Page } from "./types";

export const de: Page[] = [
	{
		path: "index.mdx",
		content: `---
title: Willkommen bei routess
description: Ein kurzer Rundgang durch routess und das Benutzerhandbuch.
translationStatus: machine-draft
---

routess ist eine Routenplanungs-App. Du setzt mehrere Stopps auf einer Karte, passt die Route an und speicherst sie fuer spaeter.

> Screenshot-Platzhalter: Startansicht mit gespeicherter Route.

## Was du tun kannst

- Mit Google anmelden
- Wegpunkte hinzufuegen, verschieben, loeschen und neu sortieren
- Distanz, Dauer und Routendetails ansehen
- Routen in deinem Konto speichern
- Sprache und Kartenstil wechseln

Starte mit [Mit Google anmelden](/de/guide/getting-started/sign-in) oder plane [deine erste Route](/de/guide/getting-started/your-first-route).
`,
	},
	{
		path: "getting-started/sign-in.mdx",
		content: `---
title: Mit Google anmelden
description: Melde dich mit deinem Google-Konto bei routess an.
translationStatus: machine-draft
---

routess nutzt Google fuer die Anmeldung. Du musst kein separates routess-Passwort verwalten.

## Schritte

1. Oeffne routess und klicke auf **Mit Google anmelden**.
2. Waehle das Google-Konto aus.
3. Bestaetige die angefragten Berechtigungen.
4. Danach kehrst du zur Karte zurueck und dein Profil ist aktiv.

> Screenshot-Platzhalter: Google-Anmeldebutton.

## Wenn es nicht klappt

Erlaube Pop-ups fuer die routess-Domain und pruefe, ob du bei accounts.google.com angemeldet bist.
`,
	},
	{
		path: "getting-started/your-first-route.mdx",
		content: `---
title: Deine erste Route
description: Plane eine Route in weniger als drei Minuten.
translationStatus: machine-draft
---

Diese kurze Uebung zeigt die wichtigsten Grundlagen.

> Screenshot-Platzhalter: leere Karte nach der Anmeldung.

## 1. Startpunkt waehlen

Klicke auf die Karte. Der erste Wegpunkt erscheint.

## 2. Stopps hinzufuegen

Klicke weitere Stellen auf der Karte an. routess zeichnet die Verbindung waehrend der Planung.

## 3. Anpassen

Ziehe einen Wegpunkt, um ihn zu verschieben. Pruefe die Reihenfolge in der Seitenleiste.

## 4. Speichern

Wenn du angemeldet bist, speichert routess deine Aenderungen automatisch.
`,
	},
	{
		path: "getting-started/interface-tour.mdx",
		content: `---
title: Rundgang durch die Oberflaeche
description: Lerne die wichtigsten Bereiche von routess kennen.
translationStatus: machine-draft
---

> Screenshot-Platzhalter: gesamte App mit Markierungen.

## Die Karte

Die Karte nimmt den groessten Teil des Bildschirms ein. Ziehe zum Verschieben und zoome mit Mausrad, Touch-Geste oder Buttons.

## Die Routenseitenleiste

Sie zeigt Wegpunkte, Reihenfolge, Distanz und Dauer.

## Das Kontomenue

Oben rechts findest du Profil, Sprache und Kontoaktionen.

## Kartensteuerung

Mit den Kartenbuttons zoomst du, zeigst deinen Standort und wechselst den Kartenstil.
`,
	},
	{
		path: "routes/creating-routes.mdx",
		content: `---
title: Routen erstellen
description: Fuege Wegpunkte hinzu und baue eine Route auf der Karte.
translationStatus: machine-draft
---

Eine Route ist eine Liste von Wegpunkten. Klicke auf die Karte, um einen Punkt hinzuzufuegen.

> Screenshot-Platzhalter: Wegpunkt auf der Karte setzen.

- Der erste Klick setzt den Startpunkt.
- Weitere Klicks fuegen Stopps hinzu.
- routess zeichnet die Verbindung zwischen den Punkten.
- Die Seitenleiste aktualisiert sich sofort.

## Tipp

Zoome zuerst in den Bereich, den du planen willst. Setze grobe Punkte und verfeinere sie danach durch Ziehen.
`,
	},
	{
		path: "routes/editing-routes.mdx",
		content: `---
title: Routen bearbeiten
description: Verschiebe, sortiere, loesche, mache rueckgaengig und bearbeite gespeicherte Routen.
translationStatus: machine-draft
---

> Screenshot-Platzhalter: Wegpunkt wird gezogen mit Anzeige fuer ungespeicherte Aenderungen.

## Verschieben

Ziehe einen Wegpunkt auf der Karte. routess aktualisiert die Route, wenn du ihn loslaesst.

## Loeschen

Rechtsklick (oder langer Druck) auf einen Wegpunkt entfernt ihn. Die Route wird um die Luecke neu berechnet.

## Hover-Synchronisation zwischen Seitenleiste und Karte

Fahre in der Seitenleiste ueber einen Wegpunkt, um ihn auf der Karte hervorzuheben, und umgekehrt. Praktisch bei langen Routen mit vielen Wegpunkten.

## Rueckgaengig und wiederholen

- **Rueckgaengig:** Undo-Button oder \`Strg/Cmd + Z\`
- **Wiederholen:** Redo-Button oder \`Strg/Cmd + Umschalt + Z\`

routess speichert die vollstaendige Bearbeitungshistorie der aktuellen Sitzung.

## Gespeicherte Route direkt bearbeiten

Oeffne eine Route aus deiner Bibliothek und bearbeite Name, Beschreibung, Sichtbarkeit oder Wegpunkte direkt. Eine Anzeige "Ungespeicherte Aenderungen" erscheint neben dem Titel, solange Aenderungen ausstehen. Klicke auf **Speichern**, um sie zu uebernehmen, oder auf **Verwerfen**, um zur letzten gespeicherten Version zurueckzukehren. Beim Verlassen mit ungespeicherten Aenderungen fragt routess zuerst nach.

## Zuruecksetzen

Klicke auf **Zuruecksetzen**, um die aktuelle Route komplett zu loeschen. Das ist sofort rueckgaengig zu machen.
`,
	},
	{
		path: "routes/saving-routes.mdx",
		content: `---
title: Routen speichern
description: Wie routess deine Routen zwischen Sitzungen erhaelt.
translationStatus: machine-draft
---

Wenn du angemeldet bist, speichert routess deine Route automatisch.

Deine Route bleibt verfuegbar nach:

- Neuladen der Seite
- Schliessen und erneutem Oeffnen des Browsers
- Anmeldung auf einem anderen Geraet

Es gibt keinen separaten Speichern-Button. routess speichert waehrend du arbeitest.

## Ohne Konto

Ohne Anmeldung kannst du planen, aber die Route bleibt nur lokal in deinem Browser.
`,
	},
	{
		path: "routes/route-info.mdx",
		content: `---
title: Routeninformationen
description: Distanz, Dauer, Hoehe und Untergrund.
translationStatus: machine-draft
---

Die Seitenleiste zeigt Live-Informationen, waehrend du die Route erstellst.

> Screenshot-Platzhalter: Seitenleiste mit Distanz, Dauer, Hoehe und Untergrund-Diagramm.

## Gesamtwerte

- **Distanz** — Summe aller Abschnitte, in km oder mi (im Konto einstellbar)
- **Dauer** — geschaetzte Reisezeit fuer die gewaehlte Sportart
- **Hoehenmeter** — Gesamtanstieg ueber die ganze Route

## Werte pro Abschnitt

Klicke auf einen Wegpunkt in der Seitenleiste, um ihn auszuklappen. Du siehst Distanz und Dauer des Abschnitts, der zu diesem Punkt fuehrt.

## Hoehen- und Untergrund-Diagramm

Unter den Werten zeigt ein einziges Diagramm das Hoehenprofil mit dem Untergrund als farbige Baender darunter. Bewege den Zeiger ueber das Diagramm, um an dieser Stelle Hoehe, Distanz und Untergrund zu sehen. Der entsprechende Punkt auf der Karte wird mit hervorgehoben.

Die Routenlinie auf der Karte nutzt zudem Strichmuster fuer den Untergrund: durchgezogen fuer asphaltiert, gestrichelt fuer unbefestigt, gepunktet fuer Pfade. Diagramm und Karte teilen sich dieselbe Farbskala.

## Wie Schaetzungen berechnet werden

Die Dauer nutzt deine Geschwindigkeit pro Sportart aus **Einstellungen → Sportarten**. Jede Sportart (Gehen, Laufen, Radfahren, Fahren) hat eine eigene Standardgeschwindigkeit; passe sie an, falls sie nicht zu deinem tatsaechlichen Tempo passt. Hoehe kommt von Mapbox Terrain-RGB; Untergrund vom Routing-Motor.
`,
	},
	{
		path: "routes/sharing-routes.mdx",
		content: `---
title: Routen teilen
description: Teile eine Route per Link oder ueber System-Teilen.
translationStatus: machine-draft
---

Oeffne eine gespeicherte Route und klicke auf **Teilen**, um den Teilen-Dialog zu oeffnen.

> Screenshot-Platzhalter: Teilen-Dialog mit Link, Kopieren und systemweitem Teilen.

## Was im Dialog steht

- **Link kopieren** — kopiert die oeffentliche URL der Route in die Zwischenablage.
- **System-Teilen** — auf dem Smartphone oeffnet sich das Teilen-Menue (WhatsApp, Nachrichten, Mail, ...).
- **Vorschau** — Miniaturbild und Routenwerte, damit der Empfaenger weiss, was er bekommt.

## Oeffentlich oder privat

Eine Route zu teilen erfordert, dass sie **oeffentlich** ist. Bei einer privaten Route bittet der Dialog zuerst um Umschaltung der Sichtbarkeit und warnt, dass der Link dann fuer alle einsehbar ist. Spaeter kannst du ueber **Bearbeiten → Sichtbarkeit** wieder auf privat zurueck.

## Was der Empfaenger sieht

Jeder mit dem Link sieht die Route auf der Karte, die Werte, das Hoehen- und Untergrund-Diagramm und einen Button zum Herunterladen als GPX. Ein Konto ist zum Ansehen nicht noetig. Um eine Kopie in die eigene Bibliothek zu speichern, ist eine Anmeldung erforderlich.
`,
	},
	{
		path: "map/navigation.mdx",
		content: `---
title: Kartennavigation
description: Karte verschieben, zoomen und ausrichten.
translationStatus: machine-draft
---

> Screenshot-Platzhalter: Kartensteuerung.

## Verschieben

Klicke und ziehe, um die Karte zu bewegen. Auf Touch-Geraeten ziehst du mit einem Finger.

## Zoomen

Nutze Mausrad, Pinch-Geste oder Zoombuttons.

## Ausrichten

Wenn Rotation aktiv ist, nutze die Standardgesten deines Geraets. Richte die Karte wieder nach Norden aus, wenn du mehr Uebersicht brauchst.
`,
	},
	{
		path: "map/styles.mdx",
		content: `---
title: Kartenstile
description: Wechsle zwischen Kartenansichten.
translationStatus: machine-draft
---

routess bietet mehrere Kartenstile, damit die Karte zur Aufgabe passt.

> Screenshot-Platzhalter: Menue fuer Kartenstile.

## Verfuegbare Stile

- **Strassen** fuer die normale Planung
- **Satellit** zur Erkennung von Umgebung und Gelaende
- **Dunkel** fuer wenig Licht

Der gewaehlte Stil bleibt im Browser gespeichert.
`,
	},
	{
		path: "map/your-location.mdx",
		content: `---
title: Dein Standort
description: Zeige deinen aktuellen Standort auf der Karte.
translationStatus: machine-draft
---

routess kann deinen Standort anzeigen, wenn dein Browser die Berechtigung hat.

> Screenshot-Platzhalter: Standortpunkt auf der Karte.

## Standort aktivieren

Klicke auf **Mein Standort** und waehle **Erlauben**, wenn der Browser fragt.

## Datenschutz

Die Berechtigung wird vom Browser verwaltet. Du kannst sie spaeter in den Browser- oder Geraeteeinstellungen entziehen.
`,
	},
	{
		path: "account/profile.mdx",
		content: `---
title: Dein Profil
description: Profil und Einstellungen pro Sportart ansehen und aktualisieren.
translationStatus: machine-draft
---

Oeffne das Menue oben rechts und klicke auf deinen Avatar.

> Screenshot-Platzhalter: Profilansicht mit Sport-Einstellungen.

## Was du aendern kannst

- Anzeigename
- Distanzeinheit (Kilometer oder Meilen)
- Standard-Kartenstil
- **Sportarten** — welche Sportarten du planst (Gehen, Laufen, Radfahren, Fahren) und ein Standardtempo je Sportart

Deine E-Mail-Adresse kommt aus deinem Google-Konto und kann in routess nicht geaendert werden.

## Sportarten und Tempo

Waehle bei der Onboarding eine oder mehrere Sportarten oder passe sie spaeter in **Einstellungen → Sportarten** an. Die aktuell gewaehlte Sportart steuert die Zeitschaetzungen deiner Routen. Jede Sportart hat ein eigenes Standardtempo; passe es an, falls es nicht zu deinem tatsaechlichen Tempo passt. Die Aenderung wirkt bei der naechsten Routenneuberechnung.
`,
	},
	{
		path: "account/language.mdx",
		content: `---
title: Sprache
description: Aendere die Sprache der App.
translationStatus: machine-draft
---

routess ist verfuegbar in:

- English
- Nederlands
- Francais
- Deutsch

## Sprache wechseln

Oeffne das Kontomenue und waehle die gewuenschte Sprache. Die Oberflaeche wird sofort aktualisiert.

## Fuer Entwickler

Wenn du eine Sprache hinzufuegen oder Uebersetzungen verbessern willst, lies die Dokumentation zum i18n-Paket.
`,
	},
	{
		path: "account/deleting-account.mdx",
		content: `---
title: Konto loeschen
description: Loesche dein routess-Konto und deine Routen dauerhaft.
translationStatus: machine-draft
---

Du kannst dein routess-Konto jederzeit loeschen. Diese Aktion ist dauerhaft.

## Was geloescht wird

- Dein Profil
- Alle gespeicherten Routen
- Die Verbindung zu deiner Google-Anmeldung

Pruefe vor dem Loeschen, ob du deine Routen noch brauchst. routess kann sie danach nicht wiederherstellen.
`,
	},
	{
		path: "troubleshooting.mdx",
		content: `---
title: Fehlerbehebung
description: Loesungen fuer haeufige Probleme.
translationStatus: machine-draft
---

## Anmeldung klappt nicht

- **Google-Pop-up wird blockiert.** Erlaube Pop-ups fuer die routess-Domain.
- **Kein Konto sichtbar.** Melde dich zuerst bei accounts.google.com an.
- **Ladeanzeige bleibt stehen.** Lade die Seite neu und versuche es erneut.

## Karte laedt nicht

Pruefe deine Internetverbindung und ob Scripts fuer die routess-Domain erlaubt sind.

## Standort funktioniert nicht

Pruefe die Standortberechtigung im Browser und auf dem Geraet.
`,
	},
	{
		path: "faq.mdx",
		content: `---
title: FAQ
description: Kurze Antworten auf haeufige Fragen.
translationStatus: machine-draft
---

## Ist routess kostenlos?

Ja. routess ist Open Source. Die oeffentliche Version auf routess.com soll kostenlos nutzbar sein.

## Brauche ich ein Konto?

Du kannst ohne Konto planen, aber fuer Routen ueber mehrere Geraete hinweg musst du angemeldet sein.

## Kann ich Routen teilen?

Teilen ist Teil des geplanten Workflows. Bis dahin bleiben Routen in deinem Konto.

## Welche Sprachen werden unterstuetzt?

English, Nederlands, Francais und Deutsch.
`,
	},
];
