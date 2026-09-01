import fs from 'node:fs';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultPublicDirectory = path.resolve(currentDirectory, '../../public');
const allowedImageDirectories = new Set(['products', 'plagues', 'crops']);

export const IMAGE_UPLOAD_LIMITS = Object.freeze({
  fileSize: 5 * 1024 * 1024,
  files: 10,
});

const allowedImageTypes = Object.freeze({
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
});

export const validateImageFile = (file) => {
  const extension = path.extname(file.originalname || '').toLowerCase();

  if (allowedImageTypes[extension] !== file.mimetype) {
    throw new Error('Sólo se permiten imágenes JPG, PNG o WEBP.');
  }

  return true;
};

const imageFileFilter = (_req, file, callback) => {
  try {
    callback(null, validateImageFile(file));
  } catch (error) {
    callback(error);
  }
};

export const ensureImageUploadDirectory = (
  imageType,
  publicDirectory = defaultPublicDirectory,
) => {
  if (!allowedImageDirectories.has(imageType)) {
    throw new Error('Directorio de imágenes no permitido.');
  }

  const uploadDirectory = path.join(publicDirectory, 'images', imageType);
  fs.mkdirSync(uploadDirectory, { recursive: true });

  return uploadDirectory;
};

const createImageStorage = (imageType) =>
  multer.diskStorage({
    destination(_req, _file, callback) {
      try {
        callback(null, ensureImageUploadDirectory(imageType));
      } catch (error) {
        callback(error);
      }
    },

    filename(_req, file, callback) {
      const extension = path.extname(file.originalname).toLowerCase();
      const fileName = `${Date.now()}-${Math.round(
        Math.random() * 100000,
      )}${extension}`;

      callback(null, fileName);
    },
  });

// CONFIGURACIÓN PARA PRODUCTOS
const productStorage = createImageStorage('products');

// CONFIGURACIÓN PARA PLAGAS
const plagueStorage = createImageStorage('plagues');

// CONFIGURACIÓN PARA CULTIVOS
const cropStorage = createImageStorage('crops');

// Upload para productos
export const upload = multer({
  storage: productStorage,
  limits: IMAGE_UPLOAD_LIMITS,
  fileFilter: imageFileFilter,
});

// Upload para plagas
export const uploadPlague = multer({
  storage: plagueStorage,
  limits: { ...IMAGE_UPLOAD_LIMITS, files: 1 },
  fileFilter: imageFileFilter,
});

export const uploadSinglePlagueImage = (req, res, next) => {
  uploadPlague.single('image')(req, res, (error) => {
    if (error) {
      const message =
        error.code === 'LIMIT_FILE_SIZE'
          ? 'La imagen no puede superar 5 MB.'
          : error.message;
      return res.status(400).send(message);
    }

    return next();
  });
};

// Upload para cultivos
export const uploadCrop = multer({
  storage: cropStorage,
  limits: IMAGE_UPLOAD_LIMITS,
  fileFilter: imageFileFilter,
});
