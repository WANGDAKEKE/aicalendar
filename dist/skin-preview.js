// A reversible presentation layer. Never reads or writes watching/rights state.
// The URL makes a skin shareable; no persistent preference is saved by this demo.
const root = document.documentElement;
const controls = [...document.querySelectorAll('[data-skin-choice]')];
const validSkin = value => value === 'lychee' ? 'lychee' : 'classic';

function skinFromUrl() {
  const params = new URLSearchParams(location.search);
  if (params.has('skin')) return validSkin(params.get('skin'));
  return params.get('reward') === 'badge' ? 'classic' : 'lychee';
}

function applySkin(value, updateUrl = false) {
  const skin = validSkin(value);
  root.dataset.calendarSkin = skin;
  for (const button of controls) {
    button.setAttribute('aria-pressed', String(button.dataset.skinChoice === skin));
  }
  if (updateUrl) {
    const url = new URL(location.href);
    url.searchParams.set('skin', skin);
    history.replaceState(history.state, '', url);
  }
}

for (const button of controls) {
  button.addEventListener('click', () => applySkin(button.dataset.skinChoice, true));
}
window.addEventListener('popstate', () => applySkin(skinFromUrl()));
applySkin(skinFromUrl());
