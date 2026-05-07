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
description: Verschiebe, sortiere, loesche, rueckgaengig und wiederhole Aenderungen.
translationStatus: machine-draft
---

> Screenshot-Platzhalter: ein Wegpunkt wird gezogen.

## Verschieben

Ziehe einen Wegpunkt auf der Karte. routess aktualisiert die Route, wenn du ihn loslaesst.

## Loeschen

Waehle einen Wegpunkt in der Seitenleiste aus und nutze die Loeschaktion.

## Rueckgaengig und wiederholen

Nutze Rueckgaengig, um eine Aenderung zurueckzunehmen. Nutze Wiederholen, um sie erneut anzuwenden.

## Reihenfolge aendern

Aendere die Reihenfolge der Stopps in der Seitenleiste, wenn die Route anders verlaufen soll.
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
description: Distanz, Dauer und Routendaten.
translationStatus: machine-draft
---

Die Seitenleiste zeigt Live-Informationen, waehrend du die Route erstellst.

> Screenshot-Platzhalter: Seitenleiste mit Distanz und Dauer.

## Gesamtwerte

- **Distanz** zeigt die gesamte Laenge.
- **Dauer** zeigt die geschaetzte Zeit.
- **Wegpunkte** zeigen Stopps und Richtungswechsel.

Die Werte aendern sich, wenn du Punkte hinzufuegst, verschiebst, loeschst oder neu sortierst.
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
description: Profil ansehen und aktualisieren.
translationStatus: machine-draft
---

Oeffne das Menue oben rechts und klicke auf Avatar oder Namen.

> Screenshot-Platzhalter: Profilansicht.

## Was du aendern kannst

- Anzeigename
- Avatar, wenn dein Konto ihn bereitstellt
- Einstellungen wie Sprache

Deine E-Mail-Adresse kommt aus deinem Google-Konto und verbindet deine Routen mit deinem Konto.
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
