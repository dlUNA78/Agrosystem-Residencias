document.addEventListener("DOMContentLoaded", function () {

  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabPanels = document.querySelectorAll(".tab-panel");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;
      tabBtns.forEach((b) => {
        b.classList.remove("border-primary", "text-[#0F2E2E]");
        b.classList.add("border-transparent", "text-on-surface-variant");
      });
      btn.classList.add("border-primary", "text-[#0F2E2E]");
      btn.classList.remove("border-transparent", "text-on-surface-variant");
      tabPanels.forEach((p) => p.classList.add("hidden"));
      document.getElementById("tab-" + target).classList.remove("hidden");
    });
  });

  function makeModal(modalId, openBtns, closeBtns, backdropId) {
    const modal = document.getElementById(modalId);
    const backdrop = document.getElementById(backdropId);
    function open() { modal.classList.remove("hidden"); document.body.style.overflow = "hidden"; }
    function close() { modal.classList.add("hidden"); document.body.style.overflow = ""; }
    openBtns.forEach((id) => { const el = document.getElementById(id); if (el) el.addEventListener("click", open); });
    closeBtns.forEach((id) => { const el = document.getElementById(id); if (el) el.addEventListener("click", close); });
    if (backdrop) backdrop.addEventListener("click", close);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  }

  makeModal("modal-reporte", ["btn-open-reporte"], ["btn-close-reporte", "btn-cancel-reporte"], "modal-reporte-backdrop");
  makeModal("modal-aplicacion", ["btn-open-aplicacion"], ["btn-close-aplicacion", "btn-cancel-aplicacion"], "modal-aplicacion-backdrop");
});
