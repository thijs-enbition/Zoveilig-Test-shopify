/*
  zv-policy-enhance.js
  Shopify renders shop policy pages (/policies/*) through its own fixed
  markup (.shopify-policy__container / __title / __body) and does not let
  a theme template replace it (confirmed: even an empty templates/policy.liquid
  is ignored). This script restructures that fixed markup client-side into
  the same visual system as sections/legal-page.liquid (hero, breadcrumb,
  sticky "Op deze pagina" sidebar, numbered sections) WITHOUT altering any
  of the actual legal text -- it only moves existing nodes and adds classes.
  Loaded only when template.name == 'policy' (see layout/theme.liquid).
*/
(function () {
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    var root = document.querySelector('.shopify-policy__container');
    if (!root) return;

    var titleH1 = root.querySelector('.shopify-policy__title h1');
    var bodyRte = root.querySelector('.shopify-policy__body .rte') || root.querySelector('.shopify-policy__body');
    if (!titleH1 || !bodyRte) return;

    var title = titleH1.textContent.trim();

    // Look for an existing "Versie ... - <date>" line in the real content so we
    // can show a "last updated" note without inventing a date ourselves.
    var updated = null;
    var versionMatch = bodyRte.textContent.match(/Versie[^\n-]*-\s*([^\n]+?)(?:\s{2,}|$)/i);
    if (versionMatch) updated = versionMatch[1].trim();

    // Split the flat list of <p>/<div>/<ul> children into numbered sections
    // whenever a paragraph starts with "Artikel N <title>". Everything before
    // the first match becomes an unlabeled intro block.
    var children = Array.prototype.slice.call(bodyRte.childNodes);
    var intro = document.createElement('div');
    intro.className = 'policy-intro';
    var sections = [];
    var current = null;

    children.forEach(function (node) {
      var num = null, headingText = null;
      if (node.nodeType === 1 && node.tagName === 'P') {
        var text = node.textContent.replace(/\s+/g, ' ').trim();
        var match = text.match(/^Artikel\s+(\d+)\s+(.*)$/);
        if (match) { num = match[1]; headingText = match[2]; }
      }

      if (num) {
        current = document.createElement('section');
        current.className = 'lg-sec';
        current.id = 's' + num;
        var h2 = document.createElement('h2');
        var badge = document.createElement('span');
        badge.className = 'n';
        badge.textContent = num + '.';
        h2.appendChild(badge);
        h2.appendChild(document.createTextNode(headingText));
        current.appendChild(h2);
        sections.push({ num: num, heading: headingText, el: current });
        return;
      }

      if (current) {
        // Review warnings appear both as plain <p> and as <div><table> blocks.
        if (node.nodeType === 1 && (node.tagName === 'P' || node.tagName === 'DIV') &&
            /^JURIDISCHE REVIEW VEREIST/i.test(node.textContent.trim())) {
          node.classList.add('lg-callout-warn');
        }
        current.appendChild(node);
      } else {
        intro.appendChild(node);
      }
    });

    bodyRte.innerHTML = '';
    if (intro.childNodes.length) bodyRte.appendChild(intro);
    sections.forEach(function (s) { bodyRte.appendChild(s.el); });
    bodyRte.classList.add('policy-body', 'lg-body', 'rte');

    var crumb = document.createElement('nav');
    crumb.className = 'crumb';
    var crumbCur = document.createElement('span');
    crumbCur.className = 'cur';
    crumbCur.textContent = title;
    crumb.innerHTML = '<a href="/">Home</a><span>›</span>';
    crumb.appendChild(crumbCur);

    var hero = document.createElement('section');
    hero.className = 'policy-hero';
    hero.innerHTML = '<div class="wrap"><span class="eyebrow"><span class="d"></span>Juridisch</span><h1></h1></div>';
    hero.querySelector('h1').textContent = title;

    var toc = document.createElement('aside');
    toc.className = 'policy-toc';
    var tocLabel = document.createElement('p');
    tocLabel.className = 'toc-label';
    tocLabel.textContent = 'Op deze pagina';
    var tocList = document.createElement('ol');
    sections.forEach(function (s) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#s' + s.num;
      a.textContent = s.heading;
      li.appendChild(a);
      tocList.appendChild(li);
    });
    toc.appendChild(tocLabel);
    toc.appendChild(tocList);
    if (updated) {
      var tocUpdated = document.createElement('p');
      tocUpdated.className = 'toc-updated';
      tocUpdated.textContent = 'Laatst bijgewerkt: ' + updated;
      toc.appendChild(tocUpdated);
    }

    var columns = document.createElement('section');
    columns.className = 'policy-columns';
    var grid = document.createElement('div');
    grid.className = 'policy-grid';
    grid.appendChild(toc);
    grid.appendChild(bodyRte);
    columns.appendChild(grid);

    root.classList.add('zv-policy-page');
    root.innerHTML = '';
    root.appendChild(crumb);
    root.appendChild(hero);
    root.appendChild(columns);
  });
})();
