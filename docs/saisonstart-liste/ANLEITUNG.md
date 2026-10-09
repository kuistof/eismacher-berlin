# Saisonstart-Liste einrichten (ca. 10 Minuten)

Die Eintragungen von eismacher-berlin.de landen in einer Google-Tabelle. Ein Apps-Script an der Tabelle verschickt die Bestätigungsmail (Double-Opt-in) und später die Eröffnungsmail mit Gratis-Kugel.

Wichtig vorab: Die Mails gehen von dem Google-Konto raus, mit dem das Script eingerichtet wird. Am besten also ein Konto der Eismacher, idealerweise Google Workspace (dort kann im Admin-Bereich der Auftragsverarbeitungsvertrag mit Google akzeptiert werden, und es sind 1.500 statt ca. 100 Mails pro Tag möglich).

## 1. Tabelle und Script anlegen

1. Neue Google-Tabelle anlegen, z. B. „Eismacher – Saisonstart-Liste“.
2. Menü **Erweiterungen → Apps Script**.
3. Den Inhalt von `Code.gs` (dieser Ordner) komplett hineinkopieren, speichern.
4. Oben in der Funktionsauswahl `einrichten` wählen, **Ausführen**. Google fragt nach Berechtigungen (Tabelle, Mail senden), zulassen. Danach gibt es das Blatt „Liste“ mit Kopfzeile.

## 2. Als Web-App veröffentlichen

1. **Bereitstellen → Neue Bereitstellung → Typ: Web-App**.
2. Ausführen als: **Ich**. Zugriff: **Jeder**.
3. **Bereitstellen**, die Web-App-URL kopieren (endet auf `/exec`).
4. Die URL in zwei Dateien bei `SIGNUP_ENDPOINT = ""` eintragen: `index.html` und `saisonstart/index.html`. Committen, pushen.

Wird `Code.gs` später geändert: **Bereitstellen → Bereitstellungen verwalten → Bearbeiten → Version: Neue Version**. So bleibt die URL gleich.

## 3. Aufräumen automatisieren

In der Datenschutzerklärung steht, dass unbestätigte Eintragungen nach 30 Tagen gelöscht werden.
Im Apps-Script links **Trigger (Wecker-Symbol) → Trigger hinzufügen**: Funktion `aufraeumen`, zeitgesteuert, täglich.

## 4. Testen

Auf der Website mit einer eigenen Adresse eintragen → Mail kommt → Link klicken → in der Tabelle steht „bestätigt“ und ein Kugel-Code.

## 5. Zur Saisoneröffnung

1. Oben in `Code.gs` ausfüllen: `EROEFFNUNG_DATUM`, `EROEFFNUNG_ZEITEN`, `KUGEL_GUELTIG_BIS`.
2. `testeEroeffnungsmail` ausführen, die Mail kommt an das eigene Konto.
3. `sendeEroeffnungsmail` ausführen. Bei privatem Google-Konto ca. 100 Mails pro Tag: dann an den Folgetagen erneut ausführen, bereits Versendete werden übersprungen. Deshalb rechtzeitig vor dem Eröffnungstag anfangen.
4. An der Theke: Mail mit Code zeigen lassen = eine Kugel gratis. Wer will, hakt den Code in der Tabelle ab.
5. Website zurückstellen: In `index.html` und `eisdiele-kreuzberg/index.html` `SAISONPAUSE = false`, die Winterpause-Section wieder durch die Öffnungszeiten ersetzen (Stand aus Commit 37e9623) und das JSON-LD `openingHoursSpecification` auf die neuen Zeiten setzen.
