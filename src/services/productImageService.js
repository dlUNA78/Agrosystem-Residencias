import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const productImageDirectory = path.resolve(
  currentDirectory,
  '../../public/images/products',
);

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
  await Promise.all(files.map((file) => removeFile(file?.path)));
};

export const cleanupStoredProductImages = async (images = []) => {
  await Promise.all(
    images.map((image) => removeFile(storedImagePath(image?.image_url))),
  );
};

export const buildProductImageRecords = ({
  productId,
  files = [],
  startOrder = 0,
  hasPrimary = false,
}) =>
  files.map((file, index) => ({
    product_id: productId,
    image_url: `images/products/${file.filename}`,
    original_name: file.originalname,
    is_primary: !hasPrimary && index === 0,
    display_order: startOrder + index,
  }));
