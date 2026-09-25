import path from 'path';
import { fileURLToPath } from 'url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

export const privateLayout = path.join(
  currentDirectory,
  '../../../views/layouts/private',
);

export const getRecordId = (record) =>
  Number(record?.id ?? record?.dataValues?.id);

export const findMissingCatalogIds = async (Model, ids, transaction) => {
  if (ids.length === 0) return [];

  const records = await Model.findAll({
    where: { id: ids },
    attributes: ['id'],
    transaction,
  });
  const existingIds = new Set(records.map(getRecordId));

  return ids.filter((id) => !existingIds.has(id));
};
