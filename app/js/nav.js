const SCREENS = ['bracket', 'standings', 'tournament', 'fillbracket'];

export function goTab(tab) {
  SCREENS.forEach((s) => {
    document.getElementById('screen-' + s).classList.toggle('on', s === tab);
  });
  document.querySelectorAll('.nav button').forEach((b) => b.classList.toggle('on', b.dataset.s === tab));
}
