/* Die Eismacher — saisonale Grüße in der Winterpause
 * Wechselt automatisch nach Datum (Uhrzeit des Besuchers):
 *   1.10.–30.11.  Herbst
 *   1.12.–26.12.  Weihnachten
 *   27.12.–31.12. Guter Rutsch
 *   1.1.–6.1.     Neujahr
 *   7.1.–31.1.    „Wir sehen uns schon bald“
 *   ab 1.2.       „Jetzt geht's bald wirklich los“
 * Elemente: [data-gruss] (große Zeile), [data-gruss-zusatz] (kleine Zeile),
 * [data-wann] („nächstes Jahr“ vor bzw. „schon bald“ nach dem Jahreswechsel).
 * Das statische HTML enthält die Herbst-Variante (für Suchmaschinen und ohne JS). */
(function () {
  'use strict';

  var AN = 'Allen unseren Eisfreunden, Gästen und Nachbarn';

  function phase(d) {
    var md = (d.getMonth() + 1) * 100 + d.getDate();
    if (md >= 1001 && md <= 1130) return 'herbst';
    if (md >= 1201 && md <= 1226) return 'weihnachten';
    if (md >= 1227) return 'rutsch';
    if (md <= 106) return 'neujahr';
    if (md <= 131) return 'januar';
    return 'vorfreude';
  }

  var TEXTE = {
    herbst:      { gruss: AN + ' eine ganz tolle Herbstzeit!', zusatz: 'Wir sehen uns nächste Saison.' },
    weihnachten: { gruss: AN + ' eine schöne Weihnachtszeit!', zusatz: 'Wir sehen uns nächste Saison.' },
    rutsch:      { gruss: AN + ' einen guten Rutsch und ein frohes neues Jahr!', zusatz: 'Wir sehen uns nächste Saison.' },
    neujahr:     { gruss: 'Frohes neues Jahr, liebe Eisfreunde, Gäste und Nachbarn!', zusatz: 'Wir sehen uns schon bald, nur noch ein paar Wochen.' },
    januar:      { gruss: 'Wir sehen uns schon bald!', zusatz: 'Nur noch ein paar Wochen, dann ist die Theke wieder voll.' },
    vorfreude:   { gruss: 'Jetzt geht’s bald wirklich los!', zusatz: 'Die Vorfreude auf die Eissaison steigt.' }
  };

  function anwenden(d) {
    var p = phase(d);
    var t = TEXTE[p];
    var nachJahreswechsel = d.getMonth() < 9; // Januar bis September
    document.querySelectorAll('[data-gruss]').forEach(function (el) { el.textContent = t.gruss; });
    document.querySelectorAll('[data-gruss-zusatz]').forEach(function (el) { el.textContent = t.zusatz; });
    document.querySelectorAll('[data-wann]').forEach(function (el) { el.textContent = nachJahreswechsel ? 'schon bald' : 'nächstes Jahr'; });
    return p;
  }

  // Zum Testen: ?saison=2026-12-24 in der URL simuliert ein Datum
  var test = /[?&]saison=(\d{4}-\d{2}-\d{2})/.exec(location.search);
  anwenden(test ? new Date(test[1] + 'T12:00:00') : new Date());
})();
