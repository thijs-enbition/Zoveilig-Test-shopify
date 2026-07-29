/* Zo Veilig — per-product brand icons.
   Line glyph (indigo) on a brand-red disc, echoing the brand-identity reference.
   window.ZVP = { PRODUCTS, badge(key, opts) } -> SVG string (viewBox 0 0 132 132). */
(function () {
  const INK = '#322469', RED = '#e24b4a', REDD = '#b5302c', CREAM = '#fbf4e0', GOLD = '#e4a311';
  const S = `fill="none" stroke="${INK}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"`;
  const SR = `fill="none" stroke="${RED}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"`;

  // each icon drawn inside a 64×64 box
  const ICONS = {
    // ambient sensing — presence dot + radiating waves
    aware: `<circle cx="20" cy="40" r="3.4" fill="${INK}"/>
      <path d="M29.9 30.1 A14 14 0 0 1 29.9 49.9" ${S}/>
      <path d="M35.6 24.4 A22 22 0 0 1 35.6 55.6" ${S}/>
      <path d="M41.2 18.8 A30 30 0 0 1 41.2 61.2" ${SR}/>`,
    // protect the whole family — shield with heart
    aware_plus: `<path d="M32 14 L49 20 V35 C49 47 32 54 32 54 C32 54 15 47 15 35 V20 Z" ${S}/>
      <path d="M32 45 C27 40 20 41.5 20 33.5 C20 28.5 27 27 32 32.5 C37 27 44 28.5 44 33.5 C44 41.5 37 40 32 45 Z" fill="${RED}"/>`,
    // alarm / home protected — house with shield + check
    secure: `<path d="M14 33 L32 17 L50 33" ${S}/><path d="M19 31 V52 H45 V31" ${S}/>
      <path d="M32 34 L40 37 V44 C40 49 32 52 32 52 C32 52 24 49 24 44 V37 Z" ${S}/>
      <path d="M28.5 43 l2.6 2.6 l4.4 -5" ${SR}/>`,
    // camera verification
    secure_plus: `<rect x="15" y="27" width="25" height="15" rx="3.5" ${S}/>
      <circle cx="22" cy="34.5" r="3.4" ${S}/>
      <path d="M40 31 L50 27 V43 L40 38" ${S}/>
      <path d="M27 42 V49 H40" ${S}/>
      <circle cx="33" cy="34.5" r="2.2" fill="${RED}"/>`,
    // 24/7 monitoring centre — headset
    care: `<path d="M15 42 V34 A17 17 0 0 1 49 34 V42" ${S}/>
      <rect x="11" y="40" width="9" height="15" rx="3.6" ${S}/>
      <rect x="44" y="40" width="9" height="15" rx="3.6" ${S}/>
      <path d="M48 55 V59 Q48 62 41 62 H35" ${S}/>
      <circle cx="32" cy="62" r="2.8" fill="${RED}"/>`,
    // someone actually comes — operator + arrival chevrons
    care_plus: `<circle cx="38" cy="24" r="5.2" ${S}/>
      <path d="M38 30 V45 M38 35 L31 39 M38 35 L45 39 M38 45 L33 56 M38 45 L44 56" ${S}/>
      <path d="M13 33 l6 6 l-6 6" ${SR}/><path d="M22 33 l6 6 l-6 6" ${SR}/>`,
    // Securitas watches — eye inside shield
    guard: `<path d="M32 12 L50 19 V34 C50 49 32 56 32 56 C32 56 14 49 14 34 V19 Z" ${S}/>
      <path d="M22 33 Q32 25 42 33 Q32 41 22 33 Z" ${S}/>
      <circle cx="32" cy="33" r="3.6" fill="${RED}"/>`,
    // maximum protection — layered shields + check
    guard_plus: `<path d="M32 10 L52 18 V34 C52 50 32 58 32 58 C32 58 12 50 12 34 V18 Z" ${S}/>
      <path d="M32 19 L43 23.5 V34 C43 43 32 48 32 48 C32 48 21 43 21 34 V23.5 Z" ${SR}/>
      <path d="M28 34 l3.4 3.4 l6 -6.4" ${S}/>`,
    // wearable SOS button
    liogo_solo: `<path d="M25 14 L31 30 M39 14 L33 30" ${S}/>
      <circle cx="32" cy="42" r="14" ${S}/>
      <circle cx="32" cy="42" r="6.2" fill="${RED}"/>`,
    // automatic fall detection — fallen figure + ceiling-sensor waves
    liogo_care: `<path d="M13 55 H45" ${S}/>
      <circle cx="24" cy="49" r="4.6" ${S}/>
      <path d="M28 51 L40 47 M31 50 L34 41 M33 49 L43 52" ${S}/>
      <circle cx="13" cy="13" r="2.6" fill="${RED}"/>
      <path d="M18 12 A9 9 0 0 1 22 20" ${SR}/>
      <path d="M22 9 A17 17 0 0 1 30 23" ${SR}/>`,
    // fall + dispatched help — fallen figure + medical response
    liogo_guard: `<path d="M13 55 H42" ${S}/>
      <circle cx="24" cy="49" r="4.6" ${S}/>
      <path d="M28 51 L39 47 M31 50 L34 41 M33 49 L43 52" ${S}/>
      <circle cx="16" cy="20" r="9" ${SR}/>
      <path d="M16 15 V25 M11 20 H21" fill="none" stroke="${RED}" stroke-width="2.8" stroke-linecap="round"/>`,
    // Zakelijk — access control panel + keyhole
    toegang: `<rect x="15" y="16" width="34" height="40" rx="5" ${S}/>
      <path d="M27 16 V11 H37 V16" ${S}/>
      <circle cx="32" cy="33" r="5" fill="${RED}"/>
      <path d="M32 37 L29 48 H35 Z" fill="${RED}"/>`,
    // Zakelijk — camera & monitoring (hexagon body + lens + camcorder)
    camera: `<path d="M13 34 L23 22 H39 L49 34 L39 46 H23 Z" ${S}/>
      <circle cx="29" cy="34" r="6.5" ${S}/>
      <circle cx="29" cy="34" r="2.4" fill="${RED}"/>
      <path d="M49 30 L57 26 V42 L49 38" ${S}/>`,
    // Zakelijk — 24/7 opvolging (shield + alert)
    opvolging: `<path d="M32 12 L50 19 V34 C50 49 32 56 32 56 C32 56 14 49 14 34 V19 Z" ${S}/>
      <path d="M32 25 V38" ${SR}/>
      <circle cx="32" cy="46" r="2.8" fill="${RED}"/>`,
  };

  const PRODUCTS = [
    { key:'aware',       name:'Aware',                   platform:'NAMI',   hook:'Weet dat ze veilig wonen' },
    { key:'aware_plus',  name:'Aware+',                  platform:'NAMI',   hook:'Bescherm het hele gezin' },
    { key:'secure',      name:'Secure',                  platform:'NAMI',   hook:'Slaap rustig in uw eigen huis' },
    { key:'secure_plus', name:'Secure+',                 platform:'NAMI',   hook:'Zie wat er gebeurt, als het telt' },
    { key:'care',        name:'Care',                    platform:'Climax', hook:'Wij zijn er als u er niet kunt zijn' },
    { key:'care_plus',   name:'Care+',                   platform:'Climax', hook:'Niet alleen een melding, iemand die komt' },
    { key:'guard',       name:'Guard',                   platform:'Climax', hook:'Securitas waakt over uw huis' },
    { key:'guard_plus',  name:'Guard+',                  platform:'Climax', hook:'Maximale bescherming, niets aan het toeval' },
    { key:'liogo_guard', name:'LioGo Guard / Response',  platform:'Indigo', hook:'Vallen wordt opgemerkt, en er komt hulp' },
    { key:'toegang',     name:'Toegangscontrole',        platform:'Zakelijk', hook:'Bepaal wie waar binnenkomt' },
    { key:'camera',      name:'Camera & monitoring',     platform:'Zakelijk', hook:'Bewaking, ook na sluitingstijd' },
    { key:'opvolging',   name:'24/7 opvolging',          platform:'Zakelijk', hook:'De meldkamer kijkt altijd mee' },
  ];

  function badgeInner(key) {
    return `<defs>
        <linearGradient id="disc_${key}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#ea5747"/><stop offset="100%" stop-color="${RED}"/>
        </linearGradient>
        <filter id="ds_${key}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>
      </defs>
      <ellipse cx="90" cy="46" rx="28" ry="28" fill="${REDD}" opacity="0.22" filter="url(#ds_${key})"/>
      <circle cx="88" cy="42" r="27" fill="url(#disc_${key})"/>
      <g transform="translate(12,24) scale(1.26)">${ICONS[key] || ''}</g>`;
  }
  function bgr(bg, W, H, rx) {
    const f = bg === 'cream' ? CREAM : bg === 'white' ? '#ffffff' : 'transparent';
    return f === 'transparent' ? '' : `<rect x="0" y="0" width="${W}" height="${H}" rx="${rx}" fill="${f}"/>`;
  }

  function badge(key, opts = {}) {
    const o = Object.assign({ bg: 'transparent' }, opts);
    return `<svg viewBox="0 0 132 132" xmlns="http://www.w3.org/2000/svg">${bgr(o.bg, 132, 132, 24)}${badgeInner(key)}</svg>`;
  }

  // bare line glyph (no disc) — for in-page use where a plain icon is wanted
  function glyph(key, opts = {}) {
    const o = Object.assign({ bg: 'transparent' }, opts);
    return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">${bgr(o.bg, 64, 64, 12)}${ICONS[key] || ''}</svg>`;
  }

  // version with the product name baked in
  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function wrapTxt(str, max){ const w=String(str).split(/\s+/),out=[];let cur='';
    for(const x of w){ if(cur && (cur+' '+x).length>max){out.push(cur);cur=x;} else cur=cur?cur+' '+x:x; } if(cur)out.push(cur); return out; }

  function labeled(key, opts = {}) {
    const o = Object.assign({ bg: 'transparent' }, opts);
    const p = PRODUCTS.find(x => x.key === key) || { name: '', platform: '', hook: '' };
    const hookLines = wrapTxt(p.hook || '', 32);
    const W = 360, H = 250 + hookLines.length * 24;
    let nameY = 184;
    let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="'Titillium Web',sans-serif">
      ${bgr(o.bg, W, H, 28)}
      <g transform="translate(114,12)">${badgeInner(key)}</g>
      <text x="180" y="${nameY}" text-anchor="middle" font-size="13" font-weight="800" letter-spacing="2.5" fill="#a89f86">${esc((p.platform || '').toUpperCase())}</text>
      <text x="180" y="${nameY + 30}" text-anchor="middle" font-size="24" font-weight="900" fill="${INK}">${esc(p.name)}</text>`;
    hookLines.forEach((ln, i) => {
      s += `<text x="180" y="${nameY + 58 + i * 24}" text-anchor="middle" font-size="15" font-weight="600" fill="#6f6786">${esc(ln)}</text>`;
    });
    s += `</svg>`;
    return s;
  }

  window.ZVP = { PRODUCTS, badge, labeled, glyph, ICONS };
})();
