// Mobile browsers don't reliably scroll a focused input above the on-screen
// keyboard right when it appears — often only once something else forces a
// layout recalc (like the user typing), which reads as a disorienting delayed
// "snap". Force it ourselves: scroll immediately on focus, then again once
// the keyboard's own resize animation has actually finished (visualViewport
// fires when that settles, since the timing varies by device).

function scrollFocusedIntoView() {
  const el = document.activeElement;
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}

document.addEventListener('focusin', (e) => {
  if (!e.target.matches('input, textarea')) return;
  scrollFocusedIntoView();
  setTimeout(scrollFocusedIntoView, 300);
});

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', scrollFocusedIntoView);
}
