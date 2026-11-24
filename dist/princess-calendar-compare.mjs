// Scale complete, independent 453 × 912 phone canvases; never synchronize
// either iframe's scrolling, navigation, or prototype state.
const versions = [...document.querySelectorAll('.pcc-version')];
let scheduled = false;

function fitComparison() {
  scheduled = false;
  const availableHeight = Math.max(280, window.innerHeight - 160);
  for (const version of versions) {
    const availableWidth = version.getBoundingClientRect().width;
    const scale = Math.max(.1, Math.min(.94, availableWidth / 453, availableHeight / 912));
    version.style.setProperty('--pcc-scale', String(scale));
  }
}

function scheduleFit() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(fitComparison);
}

fitComparison();
window.addEventListener('resize', scheduleFit, { passive: true });
if ('ResizeObserver' in window) {
  const observer = new ResizeObserver(scheduleFit);
  for (const version of versions) observer.observe(version);
}
