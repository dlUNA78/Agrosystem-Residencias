// Mantiene el foco dentro de los diálogos y lo devuelve al botón de apertura.
export const observeCropDialog = (dialog) => {
  if (!dialog) return;
  let previousFocus = null;
  const controls = () =>
    Array.from(
      dialog.querySelectorAll('button, input, select, textarea, a[href]'),
    ).filter((element) => !element.disabled && element.getClientRects().length);

  new MutationObserver(() => {
    if (dialog.classList.contains('hidden')) {
      previousFocus?.focus();
      return;
    }
    previousFocus = document.activeElement;
    controls()[0]?.focus();
  }).observe(dialog, { attributes: true, attributeFilter: ['class'] });

  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const elements = controls();
    const first = elements[0];
    const last = elements.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });
};
