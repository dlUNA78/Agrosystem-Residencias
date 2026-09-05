const notificationThemes = Object.freeze({
  success: {
    icon: 'check_circle',
    border: 'border-emerald-200',
    iconColor: 'text-emerald-700',
  },
  warning: {
    icon: 'warning',
    border: 'border-amber-200',
    iconColor: 'text-amber-700',
  },
  error: {
    icon: 'error',
    border: 'border-red-200',
    iconColor: 'text-red-700',
  },
  info: {
    icon: 'info',
    border: 'border-sky-200',
    iconColor: 'text-sky-700',
  },
});

const ensureContainer = () => {
  let container = document.getElementById('app-notification-region');
  if (container) return container;

  container = document.createElement('div');
  container.id = 'app-notification-region';
  container.className =
    'pointer-events-none fixed right-4 top-20 z-200 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-3';
  container.setAttribute('aria-live', 'assertive');
  container.setAttribute('aria-atomic', 'true');
  document.body.appendChild(container);
  return container;
};

const buildNotification = ({ type, title, message }) => {
  const theme = notificationThemes[type] || notificationThemes.info;
  const notification = document.createElement('section');
  notification.className = `pointer-events-auto flex translate-x-full items-start gap-3 rounded-xl border ${theme.border} bg-white p-4 opacity-0 shadow-xl transition duration-200`;
  notification.setAttribute('role', type === 'error' ? 'alert' : 'status');

  const icon = document.createElement('span');
  icon.className = `material-symbols-outlined ${theme.iconColor}`;
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = theme.icon;

  const content = document.createElement('div');
  content.className = 'min-w-0 flex-1';

  const heading = document.createElement('p');
  heading.className = 'text-sm font-bold text-on-surface';
  heading.textContent = title;

  const description = document.createElement('p');
  description.className =
    'mt-1 text-xs leading-relaxed text-on-surface-variant';
  description.textContent = message;

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className =
    'rounded-md p-1 text-on-surface-variant transition hover:bg-surface-container';
  closeButton.setAttribute('aria-label', 'Cerrar notificación');
  closeButton.innerHTML =
    '<span class="material-symbols-outlined text-base" aria-hidden="true">close</span>';

  content.append(heading, description);
  notification.append(icon, content, closeButton);
  return { notification, closeButton };
};

export const showAppNotification = ({
  type = 'info',
  title = 'Aviso',
  message,
  duration = 6000,
}) => {
  const container = ensureContainer();
  const { notification, closeButton } = buildNotification({
    type,
    title,
    message,
  });
  let timeoutId;

  const close = () => {
    clearTimeout(timeoutId);
    notification.classList.add('translate-x-full', 'opacity-0');
    window.setTimeout(() => notification.remove(), 200);
  };

  closeButton.addEventListener('click', close);
  container.appendChild(notification);
  window.requestAnimationFrame(() => {
    notification.classList.remove('translate-x-full', 'opacity-0');
  });
  timeoutId = window.setTimeout(close, duration);

  return close;
};
