import bcrypt from "bcrypt";
import db from "../models/index.js";

const { User } = db;

// ─── USUARIOS POR DEFECTO ────────────────────────────────────────────────────
// Credenciales de los usuarios semilla. Cámbialas en producción o usa
// variables de entorno si no quieres que estén aquí hardcodeadas.
const DEFAULT_USERS = [
  {
    full_name: "Administrador INIFAP",
    email: process.env.ADMIN_EMAIL || "admin@agrosystem.com",
    password: process.env.ADMIN_PASSWORD || "Admin@1234",
    role: "inifap",
  },
  {
    full_name: "Agricultor Demo",
    email: process.env.FARMER_EMAIL || "agricultor@agrosystem.com",
    password: process.env.FARMER_PASSWORD || "Farmer@1234",
    role: "agricultor",
  },
];

const SALT_ROUNDS = 10;

/**
 * Crea los usuarios por defecto si aún no existen en la base de datos.
 * Es completamente idempotente: si ambos usuarios ya existen, no hace nada.
 * Se llama automáticamente al iniciar el servidor.
 */
export async function seedDefaultUsers() {
  console.log("🌱 Verificando usuarios por defecto...");

  let createdCount = 0;

  for (const userData of DEFAULT_USERS) {
    const existing = await User.findOne({ where: { email: userData.email } });

    if (existing) {
      console.log(
        `   ✅ Usuario '${userData.role}' (${userData.email}) ya existe — se omite.`
      );
      continue;
    }

    const password_hash = await bcrypt.hash(userData.password, SALT_ROUNDS);

    await User.create({
      full_name: userData.full_name,
      email: userData.email,
      password_hash,
      role: userData.role,
    });

    console.log(
      `   🆕 Usuario '${userData.role}' creado: ${userData.email}`
    );
    createdCount++;
  }

  if (createdCount === 0) {
    console.log("🌱 Todos los usuarios por defecto ya existen. Sin cambios.");
  } else {
    console.log(
      `🌱 Seeding completado: ${createdCount} usuario(s) creado(s).`
    );
  }
}
