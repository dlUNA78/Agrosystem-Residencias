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
const productImageDirectory = path.resolve(
  currentDirectory,
  '../../public/images/products',
);

export const MAX_PRODUCT_IMAGES = 10;

const invalidRemovalMessage =
  'La selección de imágenes que deseas quitar no es válida.';
const imageLimitMessage = 'La galería puede contener como máximo 10 imágenes.';

const isProductImagePath = (filePath) => {
  if (!filePath) return false;
  const resolved = path.resolve(filePath);
  return (
    resolved === productImageDirectory ||
    resolved.startsWith(`${productImageDirectory}${path.sep}`)
  );
};

const storedImagePath = (imageUrl) => {
  const relative = String(imageUrl || '')
    .replace(/^\/+/, '')
    .replace(/^public[\\/]+/, '');
  const resolved = path.resolve(currentDirectory, '../../public', relative);
  return isProductImagePath(resolved) ? resolved : null;
};

const removeFile = async (filePath) => {
  if (!filePath || !isProductImagePath(filePath)) return;
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
};

export const cleanupUploadedProductFiles = async (files = []) => {
  await Promise.allSettled(files.map((file) => removeFile(file?.path)));
};

export const cleanupStoredProductImages = async (images = []) => {
  await Promise.allSettled(
    images.map((image) => removeFile(storedImagePath(image?.image_url))),
  );
};

export const parseRemovedProductImageIds = (rawValue) => {
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

export const parsePrimaryProductImageId = (rawValue) => {
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
    remainingImages.some((image) => Number(image.id) === primaryImageId)
  ) {
    return primaryImageId;
  }
  const existingPrimary = remainingImages.find((image) => image.is_primary);
  if (existingPrimary) return Number(existingPrimary.id);
  return remainingImages[0]?.id ? Number(remainingImages[0].id) : null;
};

export const buildProductImageUpdatePlan = ({
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

  if (remainingImages.length + newFileCount > MAX_PRODUCT_IMAGES) {
    return { error: imageLimitMessage };
  }

  const nextPrimaryId = resolveNextPrimaryId(remainingImages, primaryImageId);
  const nextImageOrder =
    remainingImages.reduce(
      (maximum, image) => Math.max(maximum, Number(image.display_order) || 0),
      -1,
    ) + 1;

  return {
    removedImages,
    remainingImages,
    hasPrimary: Boolean(nextPrimaryId),
    nextPrimaryId,
    nextImageOrder,
  };
};

export const buildProductImageRecords = ({
  productId,
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
      product_id: productId,
      image_url: `images/products/${file.filename}`,
      original_name: file.originalname,
      is_primary: !hasPrimary && index === 0,
      display_order: startOrder + index,
      ...(source ? { source } : {}),
    };
  });
};

export const buildExistingProductImageSourceUpdates = ({
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
