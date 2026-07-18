import multer from "multer";
import path from "path";


// CONFIGURACIÓN PARA PRODUCTOS
const productStorage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, "public/images/products");
    },

    filename(req, file, cb) {
        const extension = path.extname(file.originalname);

        const fileName = `${Date.now()}-${Math.round(
            Math.random() * 100000
        )}${extension}`;

        cb(null, fileName);
    },
});



// CONFIGURACIÓN PARA PLAGAS
const plagueStorage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, "public/images/plagues");
    },

    filename(req, file, cb) {
        const extension = path.extname(file.originalname);

        const fileName = `${Date.now()}-${Math.round(
            Math.random() * 100000
        )}${extension}`;

        cb(null, fileName);
    },
});


// Upload para productos
export const upload = multer({
    storage: productStorage,
});


// Upload para plagas
export const uploadPlague = multer({
    storage: plagueStorage,
});