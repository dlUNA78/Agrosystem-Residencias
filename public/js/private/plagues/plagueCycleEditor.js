const MAX_STAGES = 20;

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
};

export const createPlagueCycleEditor = () => {
  const builder = document.getElementById('biological-cycle-builder');
  const template = document.getElementById('biological-cycle-stage-template');
  const addButton = document.getElementById('btn-add-biological-stage');

  const updateStageNumbers = () => {
    if (!builder) return;
    const stages = builder.querySelectorAll('[data-biological-stage]');
    stages.forEach((stage, index) => {
      const number = stage.querySelector('[data-stage-number]');
      if (number) number.textContent = String(index + 1);
    });

    if (addButton) {
      const limitReached = stages.length >= MAX_STAGES;
      addButton.disabled = limitReached;
      addButton.classList.toggle('opacity-50', limitReached);
      addButton.classList.toggle('cursor-not-allowed', limitReached);
    }
  };

  const addStage = (stage = {}) => {
    if (!builder || !template) return;
    const currentStages = builder.querySelectorAll('[data-biological-stage]');
    if (currentStages.length >= MAX_STAGES) return;

    const fragment = template.content.cloneNode(true);
    const stageElement = fragment.querySelector('[data-biological-stage]');
    const removeButton = stageElement?.querySelector(
      '.remove-biological-stage',
    );

    populateStageInputs(stageElement, stage);
    removeButton?.addEventListener('click', () => {
      stageElement.remove();
      if (builder.querySelectorAll('[data-biological-stage]').length === 0) {
        addStage();
      }
      updateStageNumbers();
    });

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

  addButton?.addEventListener('click', () => addStage());
  reset();

  return { reset };
};
