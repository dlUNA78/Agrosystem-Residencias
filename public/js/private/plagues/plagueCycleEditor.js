const MAX_STAGES = 20;

const CYCLE_PRESETS = Object.freeze({
  holometabolo: [
    {
      title: 'Huevo',
      duration: '2-4 días',
      plantZone: 'Envés foliar',
      damageLevel: 'Sin daño directo',
      isControlWindow: true,
      description: 'Postura de huevecillos sobre follaje tierno.',
      recommendedAction:
        'Monitoreo temprano y liberación de parasitoides de huevo.',
    },
    {
      title: 'Larva (L1-L5)',
      duration: '10-16 días',
      plantZone: 'Follaje activo / brotes / fruto',
      damageLevel: 'Severo',
      isControlWindow: true,
      description:
        'Fase de mayor voracidad y daño económico directo en el cultivo.',
      recommendedAction:
        'Ventana crítica: control biológico o químico selectivo en primeros estadios.',
    },
    {
      title: 'Pupa',
      duration: '7-12 días',
      plantZone: 'Suelo superficial o residuos',
      damageLevel: 'Sin daño directo',
      isControlWindow: false,
      description: 'Fase inmóvil de metamorfosis protegida fuera del follaje.',
      recommendedAction: 'Labranza sanitaria y manejo de residuos de cosecha.',
    },
    {
      title: 'Adulto',
      duration: '10-20 días',
      plantZone: 'Dosel del cultivo',
      damageLevel: 'Bajo',
      isControlWindow: false,
      description:
        'Vuelo, dispersión entre parcelas, apareamiento y nueva oviposición.',
      recommendedAction: 'Trampeo con feromonas o trampas cromáticas.',
    },
  ],
  hemimetabolo: [
    {
      title: 'Huevo',
      duration: '3-5 días',
      plantZone: 'Brotes tiernos y envés foliar',
      damageLevel: 'Sin daño directo',
      isControlWindow: false,
      description: 'Incubación sobre tejido vegetativo en expansión.',
      recommendedAction: 'Inspección semanal de brotes vegetativos.',
    },
    {
      title: 'Ninfa (N1-N5)',
      duration: '10-14 días',
      plantZone: 'Envés de hojas y brotes',
      damageLevel: 'Moderado',
      isControlWindow: true,
      description:
        'Succión de savia en colonias sésiles y secreción de mielecilla.',
      recommendedAction:
        'Conservación/liberación de fauna benéfica o aplicación dirigida.',
    },
    {
      title: 'Adulto',
      duration: '20-35 días',
      plantZone: 'Dosel completo y parcelas vecinas',
      damageLevel: 'Severo',
      isControlWindow: true,
      description:
        'Dispersión alada, alimentación continua y potencial transmisión viral/bacteriana.',
      recommendedAction:
        'Trampeo cromático y rotación de ingredientes sistémicos.',
    },
  ],
  hongo: [
    {
      title: 'Germinación e infección',
      duration: '1-3 días',
      plantZone: 'Superficie foliar con humedad',
      damageLevel: 'Bajo',
      isControlWindow: true,
      description:
        'Germinación de esporas y penetración epidérmica o estomática.',
      recommendedAction:
        'Aplicación preventiva de contacto o biofungicidas antagonistas.',
    },
    {
      title: 'Colonización / Latencia',
      duration: '4-8 días',
      plantZone: 'Mesófilo foliar y tallos',
      damageLevel: 'Moderado',
      isControlWindow: true,
      description:
        'Avance intercelular del micelio y aparición de primeros halos cloróticos.',
      recommendedAction:
        'Aplicación curativa temprana con fungicidas sistémicos autorizados.',
    },
    {
      title: 'Esporulación secundaria',
      duration: '7-14 días',
      plantZone: 'Haz y envés foliar',
      damageLevel: 'Severo',
      isControlWindow: false,
      description:
        'Producción masiva de estructuras reproductivas y dispersión por viento o agua.',
      recommendedAction:
        'Saneamiento de tejido afectado, ventilación y rotación FRAC.',
    },
  ],
  acaro: [
    {
      title: 'Huevo',
      duration: '2-4 días',
      plantZone: 'Envés foliar bajo telaraña',
      damageLevel: 'Sin daño directo',
      isControlWindow: true,
      description: 'Huevecillos esféricos adheridos a las nervaduras.',
      recommendedAction:
        'Aplicación de ovicidas selectivos o ácaros depredadores.',
    },
    {
      title: 'Larva hexápoda',
      duration: '1-2 días',
      plantZone: 'Envés de hojas basales',
      damageLevel: 'Bajo',
      isControlWindow: true,
      description: 'Inicio de raspado epidérmico y punteado clorótico.',
      recommendedAction: 'Liberación de Phytoseiulus o Amblyseius spp.',
    },
    {
      title: 'Protoninfa y Deutoninfa',
      duration: '3-5 días',
      plantZone: 'Tercio medio de la planta',
      damageLevel: 'Moderado',
      isControlWindow: true,
      description:
        'Incremento rápido de colonias en condiciones cálidas y secas.',
      recommendedAction:
        'Acaricidas translaminares cuidando cobertura en envés.',
    },
    {
      title: 'Adulto reproductivo',
      duration: '10-20 días',
      plantZone: 'Follaje completo y ápices',
      damageLevel: 'Severo',
      isControlWindow: false,
      description:
        'Bronceado foliar intenso, desecación y dispersión hacia plantas contiguas.',
      recommendedAction:
        'Rotación estricta de grupos IRAC para evitar resistencia.',
    },
  ],
});

const formatHistoricalStageTitle = (value) => {
  const words = String(value || '')
    .replaceAll('_', ' ')
    .trim();
  return words ? `${words.charAt(0).toUpperCase()}${words.slice(1)}` : '';
};

const pickString = (...values) => values.find(Boolean) || '';

const mapObjectStage = (stage) => {
  if (typeof stage === 'string') {
    return { title: stage, description: '', duration: '' };
  }
  const item = stage || {};
  return {
    title: pickString(item.title, item.name, item.stage),
    description: pickString(item.description, item.details, item.detail),
    duration: pickString(item.duration, item.time),
    plantZone: pickString(item.plantZone, item.zone),
    damageLevel: pickString(item.damageLevel),
    recommendedAction: pickString(item.recommendedAction, item.action),
    isControlWindow: item.isControlWindow === true,
  };
};

const normalizeStages = (rawCycle) => {
  if (!rawCycle) return [];
  let cycle = rawCycle;

  if (typeof cycle === 'string') {
    try {
      cycle = JSON.parse(cycle);
    } catch {
      return cycle
        .split(/\r?\n/)
        .map((title) => ({ title: title.trim() }))
        .filter((stage) => stage.title);
    }
  }

  if (Array.isArray(cycle)) {
    return cycle
      .map(mapObjectStage)
      .filter((stage) => stage.title || stage.description || stage.duration);
  }

  if (cycle && typeof cycle === 'object') {
    return Object.entries(cycle).map(([stage, value]) => {
      if (value && typeof value === 'object') {
        return mapObjectStage({
          ...value,
          title: value.title || formatHistoricalStageTitle(stage),
        });
      }
      return {
        title: formatHistoricalStageTitle(stage),
        description: '',
        duration: String(value || ''),
      };
    });
  }

  return [];
};

const refreshStageMetaBadge = (stageElement) => {
  const zone = stageElement?.querySelector(
    '[name="biological_cycle_zone[]"]',
  )?.value;
  const damage = stageElement?.querySelector(
    '[name="biological_cycle_damage[]"]',
  )?.value;
  const action = stageElement?.querySelector(
    '[name="biological_cycle_action[]"]',
  )?.value;
  const badge = stageElement?.querySelector('[data-stage-meta-badge]');
  if (!badge) return;

  const filledCount = [zone, damage, action].filter((val) =>
    String(val || '').trim(),
  ).length;

  badge.textContent =
    filledCount > 0 ? `${filledCount} configurados` : 'Opcional';
  badge.classList.toggle('bg-emerald-50', filledCount > 0);
  badge.classList.toggle('text-[#1b4332]', filledCount > 0);
  badge.classList.toggle('border-emerald-200', filledCount > 0);
  badge.classList.toggle('font-bold', filledCount > 0);
};

const bindStageHeaderPreview = (stageElement) => {
  const titleInput = stageElement?.querySelector(
    '[name="biological_cycle_title[]"]',
  );
  const headerLabel = stageElement?.querySelector('[data-stage-header-label]');
  if (!titleInput || !headerLabel) return;

  const syncHeader = () => {
    const val = titleInput.value.trim();
    headerLabel.textContent = val || 'Etapa del ciclo';
  };
  titleInput.addEventListener('input', syncHeader);
  syncHeader();
};

const bindAdvancedMetaWatcher = (stageElement, stage) => {
  const details = stageElement?.querySelector('[data-stage-advanced]');
  const hasAdvancedValues = Boolean(
    stage.plantZone || stage.damageLevel || stage.recommendedAction,
  );
  if (details && hasAdvancedValues) {
    details.open = true;
  }

  [
    '[name="biological_cycle_zone[]"]',
    '[name="biological_cycle_damage[]"]',
    '[name="biological_cycle_action[]"]',
  ].forEach((selector) => {
    const input = stageElement?.querySelector(selector);
    input?.addEventListener('input', () => refreshStageMetaBadge(stageElement));
    input?.addEventListener('change', () =>
      refreshStageMetaBadge(stageElement),
    );
  });

  refreshStageMetaBadge(stageElement);
};

const populateStageInputs = (stageElement, stage) => {
  const fieldMap = [
    ['[name="biological_cycle_title[]"]', stage.title],
    ['[name="biological_cycle_duration[]"]', stage.duration],
    ['[name="biological_cycle_description[]"]', stage.description],
    ['[name="biological_cycle_zone[]"]', stage.plantZone],
    ['[name="biological_cycle_damage[]"]', stage.damageLevel],
    ['[name="biological_cycle_action[]"]', stage.recommendedAction],
  ];

  fieldMap.forEach(([selector, val]) => {
    const el = stageElement?.querySelector(selector);
    if (el) el.value = val || '';
  });

  const hiddenControl = stageElement?.querySelector(
    '[name="biological_cycle_control_window[]"]',
  );
  const toggleControl = stageElement?.querySelector(
    '[data-control-window-toggle]',
  );
  const isOptimal = stage.isControlWindow === true;

  if (hiddenControl) hiddenControl.value = isOptimal ? 'true' : 'false';
  if (toggleControl) {
    toggleControl.checked = isOptimal;
    toggleControl.addEventListener('change', () => {
      if (hiddenControl) {
        hiddenControl.value = toggleControl.checked ? 'true' : 'false';
      }
    });
  }

  bindStageHeaderPreview(stageElement);
  bindAdvancedMetaWatcher(stageElement, stage);
};

const hasAnyTypedStageContent = (builder) => {
  if (!builder) return false;
  return Array.from(
    builder.querySelectorAll(
      '[name="biological_cycle_title[]"], [name="biological_cycle_description[]"]',
    ),
  ).some((input) => input.value.trim().length > 0);
};

export const createPlagueCycleEditor = () => {
  const builder = document.getElementById('biological-cycle-builder');
  const template = document.getElementById('biological-cycle-stage-template');
  const addButton = document.getElementById('btn-add-biological-stage');
  const counterBadge = document.getElementById('cycle-stage-counter');

  const updateStageNumbers = () => {
    if (!builder) return;
    const stages = Array.from(
      builder.querySelectorAll('[data-biological-stage]'),
    );
    stages.forEach((stage, index) => {
      const number = stage.querySelector('[data-stage-number]');
      if (number) number.textContent = String(index + 1);
      const upBtn = stage.querySelector('.move-stage-up');
      const downBtn = stage.querySelector('.move-stage-down');
      if (upBtn) upBtn.disabled = index === 0;
      if (downBtn) downBtn.disabled = index === stages.length - 1;
      upBtn?.classList.toggle('opacity-35', index === 0);
      downBtn?.classList.toggle('opacity-35', index === stages.length - 1);
    });

    if (counterBadge) {
      counterBadge.textContent = `${stages.length} / ${MAX_STAGES} etapas`;
    }

    if (addButton) {
      const limitReached = stages.length >= MAX_STAGES;
      addButton.disabled = limitReached;
      addButton.classList.toggle('opacity-50', limitReached);
      addButton.classList.toggle('cursor-not-allowed', limitReached);
    }
  };

  const wireReorderAndRemove = (stageElement, addFallbackStage) => {
    const upBtn = stageElement?.querySelector('.move-stage-up');
    const downBtn = stageElement?.querySelector('.move-stage-down');
    const removeButton = stageElement?.querySelector(
      '.remove-biological-stage',
    );

    upBtn?.addEventListener('click', () => {
      const prev = stageElement.previousElementSibling;
      if (prev) {
        builder.insertBefore(stageElement, prev);
        updateStageNumbers();
      }
    });

    downBtn?.addEventListener('click', () => {
      const next = stageElement.nextElementSibling;
      if (next) {
        builder.insertBefore(next, stageElement);
        updateStageNumbers();
      }
    });

    removeButton?.addEventListener('click', () => {
      stageElement.remove();
      if (builder.querySelectorAll('[data-biological-stage]').length === 0) {
        addFallbackStage();
      }
      updateStageNumbers();
    });
  };

  const addStage = (stage = {}) => {
    if (!builder || !template) return;
    const currentStages = builder.querySelectorAll('[data-biological-stage]');
    if (currentStages.length >= MAX_STAGES) return;

    const fragment = template.content.cloneNode(true);
    const stageElement = fragment.querySelector('[data-biological-stage]');

    populateStageInputs(stageElement, stage);
    wireReorderAndRemove(stageElement, () => addStage());

    builder.append(fragment);
    updateStageNumbers();
    window.lucide?.createIcons();
  };

  const reset = (rawCycle = []) => {
    if (!builder) return;
    builder.replaceChildren();
    const stages = normalizeStages(rawCycle).slice(0, MAX_STAGES);
    if (stages.length === 0) {
      addStage();
      return;
    }
    stages.forEach(addStage);
  };

  document.querySelectorAll('[data-cycle-preset]').forEach((presetBtn) => {
    presetBtn.addEventListener('click', () => {
      const key = presetBtn.getAttribute('data-cycle-preset');
      const preset = CYCLE_PRESETS[key];
      if (!preset) return;

      if (
        hasAnyTypedStageContent(builder) &&
        !window.confirm(
          '¿Reemplazar las etapas actuales con esta plantilla base?',
        )
      ) {
        return;
      }
      reset(preset);
    });
  });

  addButton?.addEventListener('click', () => addStage());
  reset();

  return { reset };
};
