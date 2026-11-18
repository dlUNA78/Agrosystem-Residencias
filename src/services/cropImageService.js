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
const cropImageDirectory = path.resolve(
  currentDirectory,
  '../../public/images/crops',
);

export const MAX_CROP_IMAGES = 10;

const invalidRemovalMessage =
  'La selección de imágenes que deseas quitar no es válida.';
const imageLimitMessage = 'La galería puede contener como máximo 10 imágenes.';

const isCropImagePath = (filePath) => {
  if (!filePath) return false;
  const resolvedPath = path.resolve(filePath);
  return (
    resolvedPath === cropImageDirectory ||
    resolvedPath.startsWith(`${cropImageDirectory}${path.sep}`)
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
  return isCropImagePath(resolvedPath) ? resolvedPath : null;
};

const removeFile = async (filePath) => {
  if (!filePath || !isCropImagePath(filePath)) return;

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
};

export const cleanupUploadedCropFiles = async (files = []) => {
  await Promise.allSettled(files.map((file) => removeFile(file?.path)));
};

export const cleanupStoredCropImages = async (images = []) => {
  await Promise.allSettled(
    images.map((image) => removeFile(storedImagePath(image?.image_url))),
  );
};

export const parseRemovedCropImageIds = (rawValue) => {
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

export const parsePrimaryCropImageId = (rawValue) => {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return null;
  }
  const str = String(rawValue).trim();
  if (!/^[1-9]\d*$/.test(str)) return null;
  const num = Number(str);
  return Number.isSafeInteger(num) ? num : null;
};

const resolveNextPrimaryId = (remainingImages, primaryImageId) => {
  if (
    primaryImageId &&
    remainingImages.some((img) => img.id === primaryImageId)
  ) {
    return primaryImageId;
  }
  const existingPrimary = remainingImages.find((img) => img.is_primary);
  if (existingPrimary) return existingPrimary.id;
  return remainingImages[0]?.id || null;
};

export const buildCropImageUpdatePlan = ({
  existingImages = [],
  removedImageIds = [],
  newFileCount = 0,
  primaryImageId = null,
}) => {
  const existingById = new Map(
    existingImages.map((image) => [Number(image.id), image]),
  );

  if (removedImageIds.some((imageId) => !existingById.has(imageId))) {
    return { error: invalidRemovalMessage };
  }

  const removedImages = removedImageIds.map((id) => existingById.get(id));
  const remainingImages = existingImages.filter(
    (image) => !removedImageIds.includes(Number(image.id)),
  );

  if (remainingImages.length + newFileCount > MAX_CROP_IMAGES) {
    return { error: imageLimitMessage };
  }

  const nextPrimaryId = resolveNextPrimaryId(remainingImages, primaryImageId);
  const nextImageOrder =
    remainingImages.reduce(
      (maximum, image) => Math.max(maximum, Number(image.display_order) || 0),
      -1,
    ) + 1;

  return {
    error: null,
    removedImages,
    remainingImages,
    nextPrimaryId,
    nextImageOrder,
    hasRemainingPrimary: Boolean(nextPrimaryId),
  };
};

export const buildCropImageRecords = ({
  cropId,
  files = [],
  startOrder = 0,
  hasPrimary = false,
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
      crop_id: cropId,
      image_url: `images/crops/${file.filename}`,
      original_name: file.originalname,
      is_primary: !hasPrimary && index === 0,
      display_order: startOrder + index,
      ...(source ? { source } : {}),
    };
  });
};

export const buildExistingCropImageSourceUpdates = ({
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
