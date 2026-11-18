import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanitizeText } from '../utils/validators.js';

export const sanitizeImageSource = (value) => {
  const cleaned = sanitizeText(value, 255);
  return cleaned || null;
};

const normalizeSourceList = (rawSources) => {
  if (rawSources === undefined || rawSources === null) return [];
  return Array.isArray(rawSources) ? rawSources : [rawSources];
};

const resolveImageSourceAt = (sources, defaultSource, index) =>
  sanitizeImageSource(sources[index]) || sanitizeImageSource(defaultSource);

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const plagueImageDirectory = path.resolve(
  currentDirectory,
  '../../public/images/plagues',
);

export const MAX_PLAGUE_IMAGES = 10;

const invalidRemovalMessage =
  'La selección de imágenes que deseas quitar no es válida.';
const imageLimitMessage = 'La galería puede contener como máximo 10 imágenes.';

const isPlagueImagePath = (filePath) => {
  if (!filePath) return false;
  const resolvedPath = path.resolve(filePath);
  return (
    resolvedPath === plagueImageDirectory ||
    resolvedPath.startsWith(`${plagueImageDirectory}${path.sep}`)
  );
};

const storedImagePath = (imageUrl) => {
  const relativePath = String(imageUrl || '')
    .replace(/^\/+/, '')
    .replace(/^public[\\/]+/, '');
  const resolvedPath = path.resolve(
    currentDirectory,
    '../../public',
    relativePath,
  );

  return isPlagueImagePath(resolvedPath) ? resolvedPath : null;
};

const removeFile = async (filePath) => {
  if (!filePath || !isPlagueImagePath(filePath)) return;

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
};

export const cleanupUploadedPlagueFiles = async (files = []) => {
  await Promise.allSettled(files.map((file) => removeFile(file?.path)));
};

export const cleanupStoredPlagueImages = async (images = []) => {
  await Promise.allSettled(
    images.map((image) => removeFile(storedImagePath(image?.url))),
  );
};

export const parseRemovedPlagueImageIds = (rawValue) => {
  const values = Array.isArray(rawValue)
    ? rawValue
    : rawValue === undefined || rawValue === null || rawValue === ''
      ? []
      : String(rawValue).split(',');

  const ids = values.map((value) => String(value).trim()).filter(Boolean);
  if (ids.some((value) => !/^[1-9]\d*$/.test(value))) return null;

  const normalized = [...new Set(ids.map(Number))];
  return normalized.every(Number.isSafeInteger) ? normalized : null;
};

export const buildPlagueImageUpdatePlan = ({
  existingImages = [],
  removedImageIds = [],
  newFileCount = 0,
}) => {
  const existingById = new Map(
    existingImages.map((image) => [Number(image.id), image]),
  );

  if (removedImageIds.some((imageId) => !existingById.has(imageId))) {
    return { error: invalidRemovalMessage };
  }

  const removedImages = removedImageIds.map((imageId) =>
    existingById.get(imageId),
  );
  const remainingImages = existingImages.filter(
    (image) => !removedImageIds.includes(Number(image.id)),
  );

  if (remainingImages.length + newFileCount > MAX_PLAGUE_IMAGES) {
    return { error: imageLimitMessage };
  }

  return {
    error: null,
    removedImages,
    nextImageOrder:
      remainingImages.reduce(
        (maximum, image) => Math.max(maximum, Number(image.sort_order) || 0),
        -1,
      ) + 1,
  };
};

export const buildPlagueImageRecords = ({
  plagueId,
  files = [],
  startOrder = 0,
  sources = [],
  defaultSource = null,
}) => {
  const normalizedSources = normalizeSourceList(sources);
  return files.map((file, index) => {
    const source = resolveImageSourceAt(
      normalizedSources,
      defaultSource,
      index,
    );
    return {
      plague_id: plagueId,
      url: `images/plagues/${file.filename}`,
      sort_order: startOrder + index,
      ...(source ? { source } : {}),
    };
  });
};

export const buildExistingPlagueImageSourceUpdates = ({
  existingImages = [],
  removedImageIds = [],
  rawIds,
  rawSources,
  defaultSource = null,
}) => {
  const ids = normalizeSourceList(rawIds);
  const sources = normalizeSourceList(rawSources);
  if (!ids.length) return [];

  const remainingIds = new Set(
    existingImages
      .map((img) => Number(img.id))
      .filter((id) => !removedImageIds.includes(id)),
  );
  const fallback = sanitizeImageSource(defaultSource);

  return ids.reduce((acc, rawId, index) => {
    const id = Number(String(rawId).trim());
    if (!Number.isSafeInteger(id) || id <= 0 || !remainingIds.has(id)) {
      return acc;
    }
    const source = sanitizeImageSource(sources[index]) || fallback;
    acc.push({ id, source });
    return acc;
  }, []);
};
