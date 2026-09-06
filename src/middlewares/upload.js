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
const invalidImageContentMessage =
  'El contenido real del archivo no corresponde a una imagen permitida.';

export const validateImageFile = (file) => {
  const extension = path.extname(file.originalname || '').toLowerCase();

  if (allowedImageTypes[extension] !== file.mimetype) {
    throw new Error('Sólo se permiten imágenes JPG, PNG o WEBP.');
  }

  return true;
};

const matchesImageSignature = (buffer, mimetype) => {
  if (mimetype === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (mimetype === 'image/png') {
    return buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }

  if (mimetype === 'image/webp') {
    return (
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }

  return false;
};

export const validateImageSignature = async (filePath, mimetype) => {
  const file = await fs.promises.open(filePath, 'r');

  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await file.read(header, 0, header.length, 0);

    if (!matchesImageSignature(header.subarray(0, bytesRead), mimetype)) {
      throw new Error(invalidImageContentMessage);
    }

    return true;
  } finally {
    await file.close();
  }
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
  limits: IMAGE_UPLOAD_LIMITS,
  fileFilter: imageFileFilter,
});

const cleanupRejectedFiles = async (files = []) => {
  await Promise.allSettled(
    files.map(async (file) => {
      if (file?.path) await fs.promises.rm(file.path, { force: true });
    }),
  );
};

const imageUploadErrorMessage = (error) => {
  if (error.code === 'LIMIT_FILE_SIZE') {
    return 'Cada imagen puede pesar como máximo 5 MB.';
  }

  if (
    error.code === 'LIMIT_FILE_COUNT' ||
    error.code === 'LIMIT_UNEXPECTED_FILE'
  ) {
    return `Puedes subir como máximo ${IMAGE_UPLOAD_LIMITS.files} imágenes por vez.`;
  }

  if (error.message === 'Sólo se permiten imágenes JPG, PNG o WEBP.') {
    return error.message;
  }

  return 'No se pudo procesar la carga de imágenes.';
};

const createMultipleImageMiddleware = (uploader) => (req, res, next) => {
  uploader.array('images', IMAGE_UPLOAD_LIMITS.files)(
    req,
    res,
    async (error) => {
      if (error) {
        await cleanupRejectedFiles(req.files);
        return res.status(400).send(imageUploadErrorMessage(error));
      }

      try {
        await Promise.all(
          (req.files || []).map((file) =>
            validateImageSignature(file.path, file.mimetype),
          ),
        );
      } catch (signatureError) {
        await cleanupRejectedFiles(req.files);
        console.error('Se rechazó una imagen por firma inválida:', {
          name: signatureError.name,
          code: signatureError.code,
        });
        return res.status(400).send(invalidImageContentMessage);
      }

      return next();
    },
  );
};

export const uploadPlagueImages = createMultipleImageMiddleware(uploadPlague);

// Upload para cultivos
export const uploadCrop = multer({
  storage: cropStorage,
  limits: IMAGE_UPLOAD_LIMITS,
  fileFilter: imageFileFilter,
});

export const uploadCropImages = createMultipleImageMiddleware(uploadCrop);
