/**
 * Gestor de Interacciones Visuales del Foro, Descubre Contactos y Mensajería Privada
 */
document.addEventListener('DOMContentLoaded', () => {
  // 1. Modales de Creación de Consultas
  const modal = document.getElementById('modal-create-thread');
  const btnOpenModal = document.getElementById('btn-open-create-modal');
  const btnSidebarCreate = document.getElementById('btn-sidebar-create');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnCancelModal = document.getElementById('btn-cancel-modal');
  const formCreateThread = document.getElementById('form-create-thread');

  const openModal = () => {
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  };

  const closeModal = () => {
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  };

  if (btnOpenModal) btnOpenModal.addEventListener('click', openModal);
  if (btnSidebarCreate) btnSidebarCreate.addEventListener('click', openModal);
  if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
  if (btnCancelModal) btnCancelModal.addEventListener('click', closeModal);

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  if (formCreateThread) {
    formCreateThread.addEventListener('submit', (e) => {
      e.preventDefault();
      alert('¡Consulta publicada exitosamente en el prototipo visual!');
      closeModal();
      formCreateThread.reset();
    });
  }

  // 2. Búsqueda rápida en el feed principal
  const searchInput = document.getElementById('forum-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase();
      const articles = document.querySelectorAll('section > article');
      articles.forEach((art) => {
        const text = art.innerText.toLowerCase();
        if (text.includes(term)) {
          art.style.display = 'flex';
        } else {
          art.style.display = 'none';
        }
      });
    });
  }

  // 3. Comportamiento Móvil de Mensajería Privada
  const chatSidebar = document.getElementById('chat-sidebar');
  const chatMainArea = document.getElementById('chat-main-area');
  const btnBackToContacts = document.getElementById('btn-back-to-contacts');
  const chatItems = document.querySelectorAll('.btn-select-chat');

  if (chatSidebar && chatMainArea) {
    const isMobile = () => window.innerWidth < 1024;

    const showChatOnMobile = () => {
      if (isMobile()) {
        chatSidebar.classList.add('hidden');
        chatMainArea.classList.remove('hidden');
      }
    };

    const showContactsOnMobile = () => {
      if (isMobile()) {
        chatSidebar.classList.remove('hidden');
        chatMainArea.classList.add('hidden');
      }
    };

    if (isMobile()) {
      chatMainArea.classList.add('hidden');
    }

    chatItems.forEach((item) => {
      item.addEventListener('click', () => {
        chatItems.forEach((i) => i.classList.remove('bg-card', 'border-l-4', 'border-l-[#1b4332]'));
        item.classList.add('bg-card', 'border-l-4', 'border-l-[#1b4332]');
        showChatOnMobile();
      });
    });

    if (btnBackToContacts) {
      btnBackToContacts.addEventListener('click', showContactsOnMobile);
    }

    window.addEventListener('resize', () => {
      if (!isMobile()) {
        chatSidebar.classList.remove('hidden');
        chatMainArea.classList.remove('hidden');
      } else {
        showContactsOnMobile();
      }
    });
  }

  // 4. Widget Flotante de Chat Estilo LinkedIn (Dock Inferior Derecho)
  const chatDockHeader = document.getElementById('chat-dock-header');
  const chatDockBody = document.getElementById('chat-dock-body');
  const dockChevronIcon = document.getElementById('dock-chevron-icon');

  if (chatDockHeader && chatDockBody && dockChevronIcon) {
    let isCollapsed = false;

    const toggleDock = (e) => {
      // Prevenir colapso si se hace clic en botones secundarios de opciones
      if (e.target.closest('button:not(#btn-toggle-dock)') && !e.target.closest('#btn-toggle-dock')) {
        return;
      }
      isCollapsed = !isCollapsed;
      if (isCollapsed) {
        chatDockBody.classList.add('hidden');
        dockChevronIcon.textContent = 'expand_less';
      } else {
        chatDockBody.classList.remove('hidden');
        dockChevronIcon.textContent = 'expand_more';
      }
    };

    chatDockHeader.addEventListener('click', toggleDock);

    // Botones 'Mensaje' en tarjetas de contactos que abren el dock flotante
    document.querySelectorAll('.btn-open-floating-chat').forEach((btn) => {
      btn.addEventListener('click', () => {
        isCollapsed = false;
        chatDockBody.classList.remove('hidden');
        dockChevronIcon.textContent = 'expand_more';
        chatDockHeader.scrollIntoView({ behavior: 'smooth' });
      });
    });
  }
});
