/**
 * Die Eismacher – Saisonstart-Liste
 * Google Apps Script, gebunden an eine Google-Tabelle.
 *
 * Was es tut:
 *  - doPost: nimmt Eintragungen von eismacher-berlin.de entgegen und schickt die Bestätigungsmail (Double-Opt-in)
 *  - doGet:  bestätigt (a=bestaetigen) oder meldet ab (a=abmelden), aufgerufen von /saisonstart/
 *  - sendeEroeffnungsmail: verschickt zur Saisoneröffnung die Mail mit Gratis-Kugel an alle Bestätigten
 *
 * Einrichtung: siehe ANLEITUNG.md im selben Ordner.
 */

// ---------------- Einstellungen ----------------
const SITE_URL = 'https://eismacher-berlin.de';
const ABSENDER_NAME = 'Die Eismacher';
const ANTWORT_AN = '';               // optional: E-Mail-Adresse für Antworten, sonst die des Google-Kontos

// Vor dem Versand der Eröffnungsmail ausfüllen:
const EROEFFNUNG_DATUM = '';          // z. B. 'Samstag, 13. März 2027'
const EROEFFNUNG_ZEITEN = '';         // z. B. 'täglich 13 bis 19 Uhr'
const KUGEL_GUELTIG_BIS = '';        // z. B. 'Sonntag, 28. März 2027'
// ------------------------------------------------

const BLATT = 'Liste';
const SPALTEN = ['Eingetragen am', 'E-Mail', 'Vorname', 'Status', 'Token', 'Bestätigt am', 'Eröffnungsmail gesendet', 'Kugel-Code', 'Quelle'];
const S = { DATUM: 1, EMAIL: 2, VORNAME: 3, STATUS: 4, TOKEN: 5, BESTAETIGT: 6, GESENDET: 7, CODE: 8, QUELLE: 9 };

/** Einmal von Hand ausführen: legt das Tabellenblatt mit Kopfzeile an. */
function einrichten() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(BLATT) || ss.insertSheet(BLATT);
  sh.getRange(1, 1, 1, SPALTEN.length).setValues([SPALTEN]).setFontWeight('bold');
  sh.setFrozenRows(1);
}

// ---------------- Web-App ----------------

function doPost(e) {
  const p = (e && e.parameter) || {};
  if (p.website) return json({ ok: true, status: 'ausstehend' });   // Honeypot: Bot, still ignorieren

  const email = String(p.email || '').trim().toLowerCase();
  const vorname = zelle(String(p.vorname || '').trim().slice(0, 60));
  const quelle = zelle(String(p.quelle || '').slice(0, 80));
  if (!/^[^\s@=+\-][^\s@]*@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) return json({ ok: false, error: 'email' });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = blatt();
    const zeile = findeZeile(sh, S.EMAIL, email);

    if (zeile) {
      const status = sh.getRange(zeile, S.STATUS).getValue();
      if (status === 'bestätigt') return json({ ok: true, status: 'schon_dabei' });
      // ausstehend oder abgemeldet: neuen Token, Bestätigung erneut schicken
      const token = neuerToken();
      sh.getRange(zeile, S.STATUS, 1, 2).setValues([['ausstehend', token]]);
      sh.getRange(zeile, S.DATUM).setValue(new Date());
      if (vorname) sh.getRange(zeile, S.VORNAME).setValue(vorname);
      sendeBestaetigung(email, vorname || sh.getRange(zeile, S.VORNAME).getValue(), token);
      return json({ ok: true, status: 'ausstehend' });
    }

    const token = neuerToken();
    sh.appendRow([new Date(), email, vorname, 'ausstehend', token, '', '', '', quelle]);
    sendeBestaetigung(email, vorname, token);
    return json({ ok: true, status: 'ausstehend' });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  const token = String(p.t || '');
  if (!token) return json({ ok: false, error: 'token' });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = blatt();
    const zeile = findeZeile(sh, S.TOKEN, token);
    if (!zeile) return json({ ok: false, error: 'token' });

    if (p.a === 'abmelden') {
      sh.getRange(zeile, S.STATUS).setValue('abgemeldet');
      return json({ ok: true, status: 'abgemeldet' });
    }
    if (sh.getRange(zeile, S.STATUS).getValue() !== 'bestätigt') {
      sh.getRange(zeile, S.STATUS).setValue('bestätigt');
      sh.getRange(zeile, S.BESTAETIGT).setValue(new Date());
      sh.getRange(zeile, S.CODE).setValue(token.slice(0, 6).toUpperCase());
    }
    return json({ ok: true, status: 'bestätigt' });
  } finally {
    lock.releaseLock();
  }
}

// ---------------- Mails ----------------

function sendeBestaetigung(email, vorname, token) {
  const link = SITE_URL + '/saisonstart/?a=bestaetigen&t=' + token;
  const hallo = vorname ? 'Hallo ' + vorname + ',' : 'Hallo,';
  const html =
    rahmen(
      '<p>' + esc(hallo) + '</p>' +
      '<p>schön, dass du beim Saisonstart dabei sein willst! Bitte bestätige noch kurz, dass wir dir schreiben dürfen:</p>' +
      knopf(link, 'Ja, ich will Bescheid bekommen') +
      '<p>Sobald wir im Frühjahr wieder aufmachen, bekommst du eine Mail von uns, und darin steckt deine Gratis-Kugel.</p>' +
      '<p style="color:#8a766a;font-size:13px;">Du hast dich nicht eingetragen? Dann ignorier diese Mail einfach, ohne Bestätigung passiert nichts.</p>'
    );
  mail(email, 'Bitte kurz bestätigen: Saisonstart bei Die Eismacher 🍦', html);
}

/**
 * Zur Saisoneröffnung von Hand ausführen (oben EROEFFNUNG_DATUM usw. ausfüllen).
 * Schickt an alle Bestätigten, die die Mail noch nicht haben. Bei einem privaten
 * Google-Konto sind ca. 100 Mails pro Tag möglich: dann an mehreren Tagen erneut
 * ausführen, bereits Versendete werden übersprungen.
 */
function sendeEroeffnungsmail() {
  if (!EROEFFNUNG_DATUM || !KUGEL_GUELTIG_BIS) throw new Error('Bitte oben EROEFFNUNG_DATUM und KUGEL_GUELTIG_BIS ausfüllen.');
  const sh = blatt();
  const daten = sh.getDataRange().getValues();
  let gesendet = 0;
  for (let i = 1; i < daten.length; i++) {
    const r = daten[i];
    if (r[S.STATUS - 1] !== 'bestätigt' || r[S.GESENDET - 1]) continue;
    if (MailApp.getRemainingDailyQuota() < 2) break;
    eroeffnungsmail(r[S.EMAIL - 1], r[S.VORNAME - 1], r[S.TOKEN - 1], r[S.CODE - 1]);
    sh.getRange(i + 1, S.GESENDET).setValue(new Date());
    gesendet++;
  }
  const offen = daten.slice(1).filter(r => r[S.STATUS - 1] === 'bestätigt' && !r[S.GESENDET - 1]).length - gesendet;
  Logger.log(gesendet + ' Mails verschickt, ' + offen + ' noch offen.');
}

/** Testversand der Eröffnungsmail an eine Adresse, ohne die Tabelle zu ändern. */
function testeEroeffnungsmail() {
  eroeffnungsmail(Session.getActiveUser().getEmail(), 'Test', 'testtoken', 'TEST01');
}

function eroeffnungsmail(email, vorname, token, code) {
  const hallo = vorname ? 'Hallo ' + vorname + ',' : 'Hallo,';
  const abmelden = SITE_URL + '/saisonstart/?a=abmelden&t=' + token;
  const html =
    rahmen(
      '<p>' + esc(hallo) + '</p>' +
      '<p><strong>die Theke ist wieder voll!</strong> Ab <strong>' + esc(EROEFFNUNG_DATUM) + '</strong> sind wir zurück in der Körtestraße 10' +
      (EROEFFNUNG_ZEITEN ? ', ' + esc(EROEFFNUNG_ZEITEN) : '') + '.</p>' +
      '<div style="margin:24px 0;padding:20px;border:2px dashed #c0102a;border-radius:14px;text-align:center;">' +
        '<div style="font-family:Georgia,serif;font-style:italic;font-size:24px;color:#c0102a;">Deine Gratis-Kugel</div>' +
        '<div style="margin-top:8px;font-size:13px;letter-spacing:2px;color:#8a766a;">CODE</div>' +
        '<div style="font-size:26px;font-weight:bold;letter-spacing:4px;">' + esc(code) + '</div>' +
        '<div style="margin-top:8px;font-size:13px;color:#8a766a;">Zeig diese Mail einfach an der Theke. Gültig bis ' + esc(KUGEL_GUELTIG_BIS) + '.</div>' +
      '</div>' +
      '<p>Wir freuen uns auf dich!</p>' +
      knopf('https://www.google.com/maps/dir/?api=1&destination=K%C3%B6rtestra%C3%9Fe%2010%2C%2010967%20Berlin', 'Route planen'),
      '<a href="' + abmelden + '" style="color:#8a766a;">Keine Mails mehr zum Saisonstart? Hier abmelden.</a>'
    );
  mail(email, 'Wir haben wieder auf! Deine Gratis-Kugel wartet 🍦', html, abmelden);
}

/**
 * Löscht nicht bestätigte Eintragungen, die älter als 30 Tage sind (so steht es in der Datenschutzerklärung).
 * Per Zeit-Trigger einmal täglich laufen lassen, siehe ANLEITUNG.md.
 */
function aufraeumen() {
  const sh = blatt();
  const daten = sh.getDataRange().getValues();
  const grenze = Date.now() - 30 * 24 * 60 * 60 * 1000;
  for (let i = daten.length - 1; i >= 1; i--) {
    const r = daten[i];
    if (r[S.STATUS - 1] === 'ausstehend' && new Date(r[S.DATUM - 1]).getTime() < grenze) sh.deleteRow(i + 1);
  }
}

// ---------------- Helfer ----------------

function mail(an, betreff, html, abmeldeLink) {
  const opts = { to: an, subject: betreff, htmlBody: html, name: ABSENDER_NAME };
  if (ANTWORT_AN) opts.replyTo = ANTWORT_AN;
  if (abmeldeLink) opts.headers = { 'List-Unsubscribe': '<' + abmeldeLink + '>' };
  MailApp.sendEmail(opts);
}

function rahmen(inhalt, fuss) {
  return '<div style="background:#fbf4e8;padding:24px 12px;font-family:Helvetica,Arial,sans-serif;color:#20140d;">' +
    '<div style="max-width:520px;margin:0 auto;background:#fffdf9;border:1px solid #ece0cd;border-radius:16px;padding:28px 24px;font-size:16px;line-height:1.6;">' +
      '<div style="font-family:Georgia,serif;font-style:italic;font-size:28px;color:#c0102a;margin-bottom:16px;">Die Eismacher</div>' +
      inhalt +
      '<p style="margin-top:24px;">Bis bald, mit einer Kugel in der Hand.<br>Dein Eismacher-Team</p>' +
    '</div>' +
    '<p style="max-width:520px;margin:14px auto 0;text-align:center;font-size:12px;color:#8a766a;">' +
      (fuss ? fuss + '<br>' : '') +
      'Die Eismacher · Körtestraße 10 · 10967 Berlin<br>' +
      'Geschmack &amp; Genuss UG (haftungsbeschränkt) · <a href="' + SITE_URL + '/impressum/" style="color:#8a766a;">Impressum</a> · <a href="' + SITE_URL + '/datenschutz/" style="color:#8a766a;">Datenschutz</a>' +
    '</p></div>';
}

function knopf(href, text) {
  return '<p style="text-align:center;margin:24px 0;"><a href="' + href + '" style="display:inline-block;background:#c0102a;color:#fff;text-decoration:none;padding:14px 24px;border-radius:10px;font-weight:bold;">' + esc(text) + '</a></p>';
}

function blatt() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BLATT);
  if (!sh) throw new Error('Blatt "' + BLATT + '" fehlt – bitte einmal einrichten() ausführen.');
  return sh;
}

function findeZeile(sh, spalte, wert) {
  const n = sh.getLastRow() - 1;
  if (n < 1) return 0;
  const werte = sh.getRange(2, spalte, n, 1).getValues();
  for (let i = 0; i < werte.length; i++) if (String(werte[i][0]).toLowerCase() === String(wert).toLowerCase()) return i + 2;
  return 0;
}

/** Verhindert, dass Eingaben wie "=HYPERLINK(...)" in der Tabelle als Formel laufen. */
function zelle(s) {
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function neuerToken() {
  return Utilities.getUuid().replace(/-/g, '');
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
