import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, "public/images/products");
    },

    filename(req, file, cb) {
        const extension = path.extname(file.originalname);
        const fileName = `${Date.now()}-${Math.round(Math.random() * 100000)}${extension}`;

        cb(null, fileName);
    },
});

export const upload = multer({
    storage,
});