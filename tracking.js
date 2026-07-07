/* Die Eismacher — Meta-Pixel + Cookie-Hinweis
 * Modell: Das Pixel lädt standardmäßig (kein Opt-in). Nutzer:innen können
 * jederzeit widersprechen (Opt-out) — über das Banner oder auf /datenschutz/.
 * Der Pixel-ID ist öffentlich; NICHT hier ablegen: den CAPI-Access-Token
 * (der gehört serverseitig, siehe .env / Serverless-Funktion). */
(function () {
  'use strict';

  var PIXEL_ID = '1338725961680394';
  var K_OPTOUT = 'eis_tracking_optout';   // 'true' => deaktiviert
  var K_NOTICE = 'eis_cookie_notice';      // 'seen' => Hinweis geschlossen

  function lsGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function lsSet(key, val) { try { localStorage.setItem(key, val); } catch (e) {} }

  function isOptedOut() { return lsGet(K_OPTOUT) === 'true'; }

  function loadPixel() {
    if (window.fbq) return;
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', PIXEL_ID);
    window.fbq('track', 'PageView');
  }

  /* Öffentliche API — von /datenschutz/ und vom Banner genutzt */
  window.eisTracking = {
    optOut: function () {
      lsSet(K_OPTOUT, 'true');
      if (window.fbq) { try { window.fbq('consent', 'revoke'); } catch (e) {} }
      removeBanner();
    },
    optIn: function () {
      lsSet(K_OPTOUT, 'false');
      loadPixel();
      removeBanner();
    },
    isOptedOut: isOptedOut,
    openSettings: function () { showBanner(true); }
  };

  /* Pixel standardmäßig laden, außer es wurde widersprochen */
  if (!isOptedOut()) loadPixel();

  /* ---- Cookie-Hinweis (unten) ---- */
  function removeBanner() {
    var b = document.getElementById('eis-cookie');
    if (b && b.parentNode) b.parentNode.removeChild(b);
  }

  function injectStyles() {
    if (document.getElementById('eis-cookie-css')) return;
    var css =
      '#eis-cookie{position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;max-width:720px;margin:0 auto;' +
      'background:#fffdf9;border:1px solid #ece0cd;border-radius:14px;box-shadow:0 18px 50px -20px rgba(32,20,13,.5);' +
      'padding:15px 18px;display:flex;gap:14px;align-items:center;flex-wrap:wrap;justify-content:space-between;' +
      'font-family:"Jost",system-ui,-apple-system,sans-serif;}' +
      '#eis-cookie p{margin:0;font-size:.85rem;font-weight:300;color:#20140d;line-height:1.5;flex:1 1 280px;}' +
      '#eis-cookie a{color:#c0102a;text-decoration:none;font-weight:500;}' +
      '#eis-cookie a:hover{text-decoration:underline;}' +
      '#eis-cookie .eis-btns{display:flex;gap:9px;flex:0 0 auto;}' +
      '#eis-cookie button{cursor:pointer;font-family:inherit;font-size:.72rem;font-weight:500;letter-spacing:.08em;' +
      'text-transform:uppercase;border-radius:10px;padding:11px 16px;border:1px solid transparent;transition:all .2s ease;}' +
      '#eis-cookie .ok{background:#c0102a;color:#fff;}' +
      '#eis-cookie .ok:hover{background:#8c0c20;}' +
      '#eis-cookie .no{background:transparent;color:#c0102a;border-color:rgba(192,16,42,.35);}' +
      '#eis-cookie .no:hover{border-color:#c0102a;}' +
      '@media(max-width:520px){#eis-cookie .eis-btns{width:100%;}#eis-cookie button{flex:1;}}';
    var s = document.createElement('style');
    s.id = 'eis-cookie-css';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function showBanner(force) {
    if (!force && lsGet(K_NOTICE) === 'seen') return;
    if (document.getElementById('eis-cookie')) return;
    injectStyles();
    var bar = document.createElement('div');
    bar.id = 'eis-cookie';
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-label', 'Cookie-Hinweis');
    bar.innerHTML =
      '<p>Wir nutzen Cookies und das Meta-Pixel für Reichweitenmessung und Werbung. Mehr dazu in der <a href="/datenschutz/">Datenschutzerklärung</a>.</p>' +
      '<div class="eis-btns">' +
        '<button type="button" class="no" id="eis-c-no">Ablehnen</button>' +
        '<button type="button" class="ok" id="eis-c-ok">OK, verstanden</button>' +
      '</div>';
    document.body.appendChild(bar);
    document.getElementById('eis-c-ok').addEventListener('click', function () {
      lsSet(K_NOTICE, 'seen');
      removeBanner();
    });
    document.getElementById('eis-c-no').addEventListener('click', function () {
      lsSet(K_NOTICE, 'seen');
      window.eisTracking.optOut();
    });
  }

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  ready(function () { showBanner(false); });
})();
