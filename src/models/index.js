import fs from 'fs/promises';
import path from 'path';
import { Sequelize, DataTypes } from 'sequelize';
import { fileURLToPath, pathToFileURL } from 'url';
import configData from '../config/config.js'; // Importamos la config moderna

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const config = configData[env];

const db = {};

// Inicializar Sequelize
let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, config);
}

// Leer todos los modelos de forma asíncrona y moderna
const files = await fs.readdir(__dirname);
const modelFiles = files.filter(file => {
  return (
    file.indexOf('.') !== 0 &&
    file !== basename &&
    file.slice(-3) === '.js' &&
    file.indexOf('.test.js') === -1
  );
});

for (const file of modelFiles) {
  // En ES Modules, import() necesita una URL de archivo (file://...) en Windows
  const modelUrl = pathToFileURL(path.join(__dirname, file)).href;
  const { default: modelDefiner } = await import(modelUrl);
  const model = modelDefiner(sequelize, DataTypes);
  db[model.name] = model;
}

// Ejecutar las asociaciones (relaciones) de cada modelo
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

export default db;