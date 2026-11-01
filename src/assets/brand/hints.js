// Interactivity hints. Any element with data-hint="…" pulses and gets a "Try it" label
// until the reader first uses it, so interactive diagrams don't read as static pictures.
for (const el of document.querySelectorAll('[data-hint]')) {
  const label = document.createElement('span');
  label.className = 'try-it';
  label.textContent = `Try it: ${el.dataset.hint}`;
  el.before(label);
  if (getComputedStyle(el.parentElement).textAlign === 'center') label.style.marginInline = 'auto';
  el.classList.add('hint-pulse');
  const used = () => {
    el.classList.remove('hint-pulse');
    label.classList.add('done');
    setTimeout(() => label.remove(), 450);
    for (const ev of ['pointerdown', 'input', 'keydown']) el.removeEventListener(ev, used);
  };
  for (const ev of ['pointerdown', 'input', 'keydown']) el.addEventListener(ev, used);
}
