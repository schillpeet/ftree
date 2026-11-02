// The dummy's only script: the 3D | TRON switch (remembered like the app's choice), buttons that lead to another screen
// (data-go="#id" or "page.html#id", so the app's <button> markup and CSS stay as they are), elements shown only on some
// screens, and the lineage highlight when a person in a .tree is clicked. Each page sets the stored theme in its <head> before
// painting.
const root = document.documentElement;

function syncTheme() {
  document.querySelectorAll('[data-theme-set]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.themeSet === root.dataset.theme));
  });
}

// Elements with data-show="a b" are visible only while the screen #a or #b is shown (without a hash: the first screen).
// A screen with data-select="id" selects that person when it opens with nobody selected, e.g. a panel opened by URL;
// another page can pick the person with ?select=id (invited.html opens Jonas this way).
function showFor() {
  const id = location.hash.slice(1) || document.querySelector('.screen')?.id;
  document.querySelectorAll('[data-show]').forEach((element) => {
    element.hidden = !element.dataset.show.split(' ').includes(id);
  });
  const preset = document.getElementById(id)?.dataset.select && (new URLSearchParams(location.search).get('select') ?? document.getElementById(id).dataset.select);
  const node = preset && document.querySelector(`.node[data-id="${preset}"]`);
  if (node && !document.querySelector('.node.is-selected')) select(node, false);
}

function chip(name) {
  const initials = name.split(' ').map((part) => part[0]).join('');
  return `<span class="person-chip"><span class="person-chip-main"><span class="person-avatar">${initials}</span><span class="person-chip-text"><span class="person-chip-name">${name}</span></span></span></span>`;
}

// A node's data-line names the people of its lineage by data-id (dimmed: everyone else); its data-lit names the
// lines, dots and symbols (data-k) that light up, as SimpleTree marks them. In 3D the scene shows the picture of the
// selected card (img data-for), if there is one. Elements with data-fill="name" (or "meta", …) show the selected
// person's data-name (data-meta, …); data-chips="parents" lists the names in data-parents as person chips and hides its
// .person-group when there are none. A second click on the selected person, or a click on an element with
// data-deselect (a panel's close button), clears the selection.
function select(node, clear = node.classList.contains('is-selected')) {
  const id = clear ? '' : node.dataset.id;
  const line = clear ? [] : node.dataset.line.split(' ');
  const lit = clear ? [] : node.dataset.lit.split(' ');
  document.querySelectorAll('.node').forEach((other) => {
    other.classList.toggle('is-selected', other.dataset.id === id && id !== '');
    other.classList.toggle('is-lineage', line.includes(other.dataset.id));
    other.classList.toggle('is-dimmed', !clear && !line.includes(other.dataset.id));
  });
  document.querySelectorAll('[data-k]').forEach((element) => element.classList.toggle('is-focus', lit.includes(element.dataset.k)));
  const shot = document.querySelector(`.scene3d img[data-for="${id}"]`) ? id : '';
  document.querySelectorAll('.scene3d img[data-for]').forEach((img) => (img.hidden = img.dataset.for !== shot));
  document.querySelectorAll('[data-fill]').forEach((field) => {
    const value = clear ? '' : node.dataset[field.dataset.fill] ?? '';
    if (field.matches('input, textarea')) field.value = value;
    else field.textContent = value;
  });
  document.querySelectorAll('[data-chips]').forEach((box) => {
    const names = clear ? [] : (node.dataset[box.dataset.chips] ?? '').split(', ').filter(Boolean);
    box.innerHTML = names.map(chip).join('');
    box.closest('.person-group').hidden = names.length === 0;
  });
  document.body.toggleAttribute('data-selected', !clear);
}

document.addEventListener('click', (event) => {
  const themeButton = event.target.closest('[data-theme-set]');
  if (themeButton) {
    root.dataset.theme = themeButton.dataset.themeSet;
    try {
      localStorage.setItem('ftree-dummy-theme', root.dataset.theme);
    } catch {}
    syncTheme();
  }
  // The relation legend: fold to its header, pin, close.
  const legend = event.target.closest('.relation-legend');
  if (legend && event.target.closest('.relation-legend-fold')) {
    const folded = legend.dataset.folded !== 'true';
    legend.dataset.folded = String(folded);
    legend.querySelector('ul').hidden = folded;
    legend.querySelector('.relation-legend-fold').setAttribute('aria-expanded', String(!folded));
  }
  if (legend && event.target.closest('.person-pin')) {
    const pin = event.target.closest('.person-pin');
    pin.setAttribute('aria-pressed', String(pin.getAttribute('aria-pressed') !== 'true'));
  }
  if (legend && event.target.closest('[data-close]')) legend.hidden = true;
  const go = event.target.closest('[data-go]');
  if (go && !go.disabled) location.href = go.dataset.go;
  const node = event.target.closest('.node[data-line]');
  if (node) select(node);
  const selected = event.target.closest('[data-deselect]') && document.querySelector('.node.is-selected');
  if (selected) select(selected, true);
});

addEventListener('hashchange', showFor);
showFor();
syncTheme();
