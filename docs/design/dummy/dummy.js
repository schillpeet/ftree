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

// A node's data-line names the people of its lineage (itself, ancestors, descendants, partners) by data-id; a line in
// the SVG lights up when every id in its data-ends is part of it. Elements with data-fill="name" (or "meta") show the
// selected person's data-name (data-meta, …); data-chips="parents" lists the names in data-parents as person chips and
// hides its .person-group when there are none. A second click on the selected person, or a click on an element with
// data-deselect (a panel's close button), clears the selection.
function select(node, clear = node.classList.contains('is-selected')) {
  const tree = node.closest('.tree');
  const line = clear ? [] : node.dataset.line.split(' ');
  tree.querySelectorAll('.node').forEach((other) => {
    other.classList.toggle('is-selected', !clear && other === node);
    other.classList.toggle('is-lineage', line.includes(other.dataset.id));
    other.classList.toggle('is-dimmed', !clear && !line.includes(other.dataset.id));
  });
  tree.querySelectorAll('.tree-lines path').forEach((path) => {
    path.classList.toggle('is-lineage', !clear && path.dataset.ends.split(' ').every((id) => line.includes(id)));
  });
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
