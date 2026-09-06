import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const cropImageDirectory = path.resolve(
  currentDirectory,
  '../../public/images/crops',
);

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
  await Promise.all(files.map((file) => removeFile(file?.path)));
};

export const cleanupStoredCropImages = async (images = []) => {
  await Promise.all(
    images.map((image) => removeFile(storedImagePath(image?.image_url))),
  );
};

export const buildCropImageRecords = ({
  cropId,
  files = [],
  startOrder = 0,
  hasPrimary = false,
}) =>
  files.map((file, index) => ({
    crop_id: cropId,
    image_url: `images/crops/${file.filename}`,
    original_name: file.originalname,
    is_primary: !hasPrimary && index === 0,
    display_order: startOrder + index,
  }));
