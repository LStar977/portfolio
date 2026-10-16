// The theater: opens a playable work (a page or a video) over the cockpit.
export function createTheater({ onOpen, onClose }) {
  const el = document.getElementById('theater');
  const screen = document.getElementById('theater-screen');
  const title = document.getElementById('theater-title');
  const openTab = document.getElementById('theater-open');
  const close = document.getElementById('theater-close');
  let opener = null;

  function open({ src, type, name }, from) {
    opener = from || document.activeElement;
    screen.textContent = '';
    if (type === 'video') {
      const v = document.createElement('video');
      v.src = src; v.controls = true; v.autoplay = true; v.playsInline = true;
      screen.append(v);
      v.play().catch(() => {});
    } else {
      const f = document.createElement('iframe');
      f.src = src; f.title = name;
      f.allow = 'autoplay; fullscreen';
      f.setAttribute('allowfullscreen', '');
      screen.append(f);
      f.addEventListener('load', () => { try { f.contentWindow.focus(); } catch (e) {} });
    }
    title.textContent = name;
    openTab.href = src;
    el.hidden = false;
    document.documentElement.classList.add('theater-open');
    close.focus();
    onOpen && onOpen();
  }

  function shut() {
    if (el.hidden) return;
    el.hidden = true;
    screen.textContent = '';
    document.documentElement.classList.remove('theater-open');
    onClose && onClose();
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  }

  close.addEventListener('click', shut);
  window.addEventListener('keydown', e => { if (e.key === 'Escape') shut(); });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-launch]');
    if (!b) return;
    e.preventDefault();
    open({ src: b.dataset.launch, type: b.dataset.launchType || 'page', name: b.dataset.launchTitle || b.textContent.trim() }, b);
  });
  return { open, close: shut, get isOpen() { return !el.hidden; } };
}
