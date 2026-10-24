const STAGE_ICON_RULES = [
  { pattern: /huevo|oviposi/i, icon: 'egg' },
  { pattern: /larva|oruga|gusano/i, icon: 'pest_control' },
  { pattern: /ninfa/i, icon: 'bug_report' },
  { pattern: /pupa|crisalida|crisálida/i, icon: 'shield' },
  { pattern: /adulto|mosca|palomilla|alado/i, icon: 'air' },
  {
    pattern: /espora|conidia|urediniospora|esporangio|cleistotecio/i,
    icon: 'grain',
  },
  {
    pattern: /esporulaci|lesion|lesión|micelio|infecci/i,
    icon: 'coronavirus',
  },
];

const DAMAGE_BADGE_STYLES = Object.freeze({
  severo: 'bg-rose-50 text-rose-800 border-rose-200',
  alto: 'bg-rose-50 text-rose-800 border-rose-200',
  critico: 'bg-rose-50 text-rose-800 border-rose-200',
  moderado: 'bg-amber-50 text-amber-800 border-amber-200',
  medio: 'bg-amber-50 text-amber-800 border-amber-200',
  bajo: 'bg-sky-50 text-sky-800 border-sky-200',
  'sin daño directo': 'bg-slate-100 text-slate-700 border-slate-200',
  nulo: 'bg-slate-100 text-slate-700 border-slate-200',
});

const SEGMENT_PALETTE = [
  'bg-[#1b4332]',
  'bg-[#2d6a4f]',
  'bg-[#40916c]',
  'bg-[#52b788]',
];

export const inferStageIcon = (title, explicitIcon) => {
  if (explicitIcon) return explicitIcon;
  const normalized = String(title || '');
  const matched = STAGE_ICON_RULES.find(({ pattern }) =>
    pattern.test(normalized),
  );
  return matched ? matched.icon : 'pest_control';
};

export const parseDurationDays = (duration) => {
  const text = String(duration || '').toLowerCase();
  if (!text || !/d[ií]a/i.test(text)) return null;

  const numbers = Array.from(text.matchAll(/(\d+(?:\.\d+)?)/g), (m) =>
    Number(m[1]),
  ).filter(Number.isFinite);

  if (numbers.length === 0) return null;
  const minDays = Math.min(...numbers);
  const maxDays = Math.max(...numbers);
  return {
    minDays,
    maxDays,
    avgDays: (minDays + maxDays) / 2,
  };
};

const getDamageBadgeClass = (damageLevel) => {
  const key = String(damageLevel || '')
    .trim()
    .toLowerCase()
    .replace('í', 'i');
  return (
    DAMAGE_BADGE_STYLES[key] || 'bg-muted text-muted-foreground border-border'
  );
};

const getBarColorClass = (stage, index) => {
  if (stage.isControlWindow) return 'bg-rose-600';
  const damageKey = String(stage.damageLevel || '').toLowerCase();
  if (damageKey === 'severo' || damageKey === 'alto') return 'bg-amber-500';
  return SEGMENT_PALETTE[index % SEGMENT_PALETTE.length];
};

const normalizeObjectCycleEntries = (cycleObj) =>
  Object.entries(cycleObj).map(([key, value]) => {
    const formattedTitle =
      `${key.charAt(0).toUpperCase()}${key.slice(1)}`.replaceAll('_', ' ');
    if (value && typeof value === 'object') {
      return {
        ...value,
        title: value.title || formattedTitle,
      };
    }
    return {
      title: formattedTitle,
      description: null,
      duration: value ? String(value) : null,
    };
  });

const coerceCycleArray = (rawCycle) => {
  let parsed = rawCycle;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = [parsed];
    }
  }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return normalizeObjectCycleEntries(parsed);
  }
  return Array.isArray(parsed) ? parsed : [];
};

const pickFirst = (...values) => values.find(Boolean) || null;

const buildStringStage = (stage, index, step) => ({
  step,
  title: `Etapa ${index + 1}`,
  description: stage,
  duration: null,
  plantZone: null,
  damageLevel: null,
  recommendedAction: null,
  icon: 'pest_control',
  isControlWindow: false,
});

const mapRawStage = (stage, index) => {
  const step = String(index + 1).padStart(2, '0');
  if (typeof stage === 'string') {
    return buildStringStage(stage, index, step);
  }

  const title = stage.title || `Etapa ${index + 1}`;
  return {
    step: stage.step || step,
    title,
    description: pickFirst(stage.description),
    duration: pickFirst(stage.duration),
    plantZone: pickFirst(stage.plantZone, stage.zone),
    damageLevel: pickFirst(stage.damageLevel),
    recommendedAction: pickFirst(stage.recommendedAction, stage.action),
    icon: inferStageIcon(title, stage.icon),
    isControlWindow: stage.isControlWindow === true,
  };
};

export const buildEnrichedBiologicalCycle = (rawCycle) => {
  const rawStages = coerceCycleArray(rawCycle).filter(
    (stage) => typeof stage === 'string' || stage?.description || stage?.title,
  );

  if (rawStages.length === 0) {
    return {
      stages: [],
      summary: {
        hasCycle: false,
        stageCount: 0,
        totalDurationLabel: null,
        controlWindowCount: 0,
        controlWindowLabel: null,
        hasNumericShares: false,
      },
    };
  }

  const mapped = rawStages.map(mapRawStage);
  const parsedDays = mapped.map((s) => parseDurationDays(s.duration));
  const allHaveNumericDays = parsedDays.every(Boolean);
  const anyNumericDays = parsedDays.some(Boolean);

  const totalMin = parsedDays.reduce((acc, d) => acc + (d?.minDays || 0), 0);
  const totalMax = parsedDays.reduce((acc, d) => acc + (d?.maxDays || 0), 0);
  const totalAvg = parsedDays.reduce((acc, d) => acc + (d?.avgDays || 0), 0);

  const equalShare = Math.max(1, Math.round(100 / mapped.length));
  const stages = mapped.map((stage, index) => {
    const dayInfo = parsedDays[index];
    const sharePercent =
      allHaveNumericDays && totalAvg > 0
        ? Math.max(6, Math.round((dayInfo.avgDays / totalAvg) * 100))
        : equalShare;

    return {
      ...stage,
      sharePercent,
      hasNumericShare: allHaveNumericDays && totalAvg > 0,
      damageBadgeClass: getDamageBadgeClass(stage.damageLevel),
      barColorClass: getBarColorClass(stage, index),
      isLast: index === mapped.length - 1,
    };
  });

  const controlStages = stages.filter((s) => s.isControlWindow);
  const totalDurationLabel = anyNumericDays
    ? totalMin === totalMax
      ? `${totalMin} días`
      : `${totalMin}–${totalMax} días`
    : null;

  return {
    stages,
    summary: {
      hasCycle: true,
      stageCount: stages.length,
      totalDurationLabel,
      controlWindowCount: controlStages.length,
      controlWindowLabel: controlStages.map((s) => s.title).join(', ') || null,
      hasNumericShares: allHaveNumericDays && totalAvg > 0,
    },
  };
};

const trimSentencePeriod = (value) => {
  const trimmed = value.trim();
  if (/\bspp?\.$/i.test(trimmed)) return trimmed;
  return trimmed.replace(/\.$/, '').trim();
};

export const splitTextClauses = (
  text,
  delimiterRegex = /[;\n]+|(?<!\bspp?)\.\s+/i,
) => {
  const clean = String(text || '').trim();
  if (!clean) return [];

  const primary = clean
    .split(delimiterRegex)
    .map(trimSentencePeriod)
    .filter(Boolean);

  if (primary.length > 1) return primary;

  const byComma = clean.split(/,\s+/).map(trimSentencePeriod).filter(Boolean);

  return byComma.length >= 2 ? byComma : primary;
};

export const extractBiologicalAgents = (text) => {
  const clean = String(text || '').trim();
  if (!clean) return [];

  return clean
    .split(/[,;\n]+/)
    .map(trimSentencePeriod)
    .filter((item) => item.length > 1 && item.length <= 80);
};
