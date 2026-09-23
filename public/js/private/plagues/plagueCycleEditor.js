const MAX_STAGES = 20;

const formatHistoricalStageTitle = (value) => {
  const words = String(value || '')
    .replaceAll('_', ' ')
    .trim();
  return words ? `${words.charAt(0).toUpperCase()}${words.slice(1)}` : '';
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
      .map((stage) =>
        typeof stage === 'string'
          ? { title: stage, description: '', duration: '' }
          : {
              title: stage?.title || stage?.name || stage?.stage || '',
              description:
                stage?.description || stage?.details || stage?.detail || '',
              duration: stage?.duration || stage?.time || '',
            },
      )
      .filter((stage) => stage.title || stage.description || stage.duration);
  }

  if (cycle && typeof cycle === 'object') {
    return Object.entries(cycle).map(([stage, duration]) => ({
      title: formatHistoricalStageTitle(stage),
      description: '',
      duration: String(duration || ''),
    }));
  }

  return [];
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
    const title = stageElement?.querySelector(
      '[name="biological_cycle_title[]"]',
    );
    const duration = stageElement?.querySelector(
      '[name="biological_cycle_duration[]"]',
    );
    const description = stageElement?.querySelector(
      '[name="biological_cycle_description[]"]',
    );
    const removeButton = stageElement?.querySelector(
      '.remove-biological-stage',
    );

    if (title) title.value = stage.title || '';
    if (duration) duration.value = stage.duration || '';
    if (description) description.value = stage.description || '';
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
