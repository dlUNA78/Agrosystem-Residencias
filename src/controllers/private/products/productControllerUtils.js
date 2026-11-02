import path from 'node:path';
import { fileURLToPath } from 'node:url';

import db from '../../../models/index.js';
import { CROP_WORKFLOW_STATUSES } from '../../../services/cropWorkflowService.js';
import { PLAGUE_WORKFLOW_STATUSES } from '../../../services/plagueWorkflowService.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
export const privateLayout = path.join(
  currentDirectory,
  '../../../views/layouts/private',
);

export const parsePositiveId = (value) => {
  if (!/^[1-9]\d*$/.test(String(value || ''))) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
};

export const normalizeImageUrl = (value) =>
  value
    ? `/${String(value)
        .trim()
        .replaceAll('\\', '/')
        .replace(/^\/+/, '')
        .replace(/^public\/+/, '')}`
    : null;

export const getRecordId = (record) => Number(record?.id ?? record);

export const loadFormCatalogOptions = async () => {
  const { ActiveIngredient, Crop, Plague } = db;
  const [crops, plagues, ingredients] = await Promise.all([
    Crop.findAll({
      where: {
        status: 'aprobado',
        workflow_status: CROP_WORKFLOW_STATUSES.PUBLISHED,
      },
      attributes: ['id', 'name', 'scientific_name', 'category'],
      order: [['name', 'ASC']],
      raw: true,
    }),
    Plague.findAll({
      where: {
        status: true,
        workflow_status: PLAGUE_WORKFLOW_STATUSES.PUBLISHED,
      },
      attributes: ['id', 'name', 'scientific_name', 'category'],
      order: [['name', 'ASC']],
      raw: true,
    }),
    ActiveIngredient.findAll({
      attributes: ['id', 'name', 'chemical_group', 'action_type'],
      order: [['name', 'ASC']],
      raw: true,
    }),
  ]);
  return { crops, plagues, ingredients };
};
