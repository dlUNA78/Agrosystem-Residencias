import { Sequelize } from 'sequelize';
import 'dotenv/config';
import { resolveSequelizeLogging, resolveSequelizePool } from './config.js';

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: process.env.DB_DIALECT || 'postgres',
    logging: resolveSequelizeLogging(),
    pool: resolveSequelizePool(),
  },
);

export default sequelize;
