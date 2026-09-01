import multer from 'multer';
import path from 'path';

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

// CONFIGURACIÓN PARA PRODUCTOS
const productStorage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, 'public/images/products');
  },

  filename(req, file, cb) {
    const extension = path.extname(file.originalname);

    const fileName = `${Date.now()}-${Math.round(
      Math.random() * 100000,
    )}${extension}`;

    cb(null, fileName);
  },
});

// CONFIGURACIÓN PARA PLAGAS
const plagueStorage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, 'public/images/plagues');
  },

  filename(req, file, cb) {
    const extension = path.extname(file.originalname);

    const fileName = `${Date.now()}-${Math.round(
      Math.random() * 100000,
    )}${extension}`;

    cb(null, fileName);
  },
});

// CONFIGURACIÓN PARA CULTIVOS
const cropStorage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, 'public/images/crops');
  },

  filename(req, file, cb) {
    const extension = path.extname(file.originalname);

    const fileName = `${Date.now()}-${Math.round(
      Math.random() * 100000,
    )}${extension}`;

    cb(null, fileName);
  },
});

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
