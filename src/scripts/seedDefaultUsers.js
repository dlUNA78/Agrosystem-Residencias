import bcrypt from 'bcrypt';
import db from '../models/index.js';

const { User } = db;

// ─── USUARIOS POR DEFECTO ────────────────────────────────────────────────────
// Credenciales de los usuarios semilla. Cámbialas en producción o usa
// variables de entorno si no quieres que estén aquí hardcodeadas.
const DEFAULT_USERS = [
  {
    code: 'USR-ADM-001',
    full_name: 'Administrador Principal',
    email: process.env.ADMIN_EMAIL || 'admin@agrosystem.com',
    password: process.env.ADMIN_PASSWORD || 'admin123',
    role: 'admin',
    phone: '6671234567',
    address: 'Av. Insurgentes Sur 1200, Culiacán, Sinaloa',
    job_title: 'Administrador del Sistema',
    shift: 'Matutino',
    photo_url:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    status: 'activo',
  },
  {
    code: 'USR-INF-002',
    full_name: 'Dr. Roberto Mendoza INIFAP',
    email: 'investigador@agrosystem.com',
    password: '123456',
    role: 'inifap',
    phone: '6679876543',
    address: 'Campo Experimental Valle de Culiacán, INIFAP',
    job_title: 'Investigador Fitosanitario Senior',
    shift: 'Completo',
    photo_url:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
    status: 'activo',
  },
  {
    code: 'USR-INF-003',
    full_name: 'Ing. María Fernanda López',
    email: 'tecnico@agrosystem.com',
    password: '123456',
    role: 'inifap',
    phone: '6675551234',
    address: 'Estación de Sanidad Vegetal INIFAP',
    job_title: 'Técnico Agrónomo',
    shift: 'Matutino',
    photo_url:
      'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80',
    status: 'activo',
  },
  {
    code: 'USR-AGR-004',
    full_name: 'Juan Pérez el Agricultor',
    email: 'juan@agricultor.com',
    password: '123456',
    role: 'agricultor',
    phone: '6674448899',
    address: 'Ejido Bellavista Lote 12, Culiacán',
    job_title: 'Productor de Hortalizas',
    shift: 'Variable',
    photo_url:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
    status: 'activo',
  },
  {
    code: 'USR-AGR-005',
    full_name: 'Carlos Ruiz Productor',
    email: process.env.FARMER_EMAIL || 'agricultor@agrosystem.com',
    password: process.env.FARMER_PASSWORD || '123456',
    role: 'agricultor',
    phone: '6673332211',
    address: 'Valle del Fuerte Parcela 45, Los Mochis',
    job_title: 'Productor de Granos',
    shift: 'Variable',
    photo_url:
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=300&q=80',
    status: 'activo',
  },
  {
    code: 'USR-AGR-006',
    full_name: 'Farmer Expediente Test',
    email: 'farmer_expediente@agrosystem.com',
    password: '123456',
    role: 'agricultor',
    phone: '6671112233',
    address: 'Predio San José s/n',
    job_title: 'Agricultor Registrado',
    shift: 'Matutino',
    photo_url: null,
    status: 'activo',
  },
];

const SALT_ROUNDS = 10;

/**
 * Crea los usuarios por defecto si aún no existen en la base de datos.
 * Es completamente idempotente: si los usuarios ya existen, actualiza sus contraseñas y datos.
 * Se llama automáticamente al iniciar el servidor.
 */
export async function seedDefaultUsers() {
  console.log('🌱 Verificando usuarios por defecto...');

  let createdCount = 0;
  let updatedCount = 0;

  for (const userData of DEFAULT_USERS) {
    const existing = await User.findOne({ where: { email: userData.email } });
    const password_hash = await bcrypt.hash(userData.password, SALT_ROUNDS);

    if (existing) {
      await existing.update({
        code: userData.code || existing.code,
        full_name: userData.full_name,
        password_hash,
        role: userData.role,
        phone: userData.phone || existing.phone,
        address: userData.address || existing.address,
        job_title: userData.job_title || existing.job_title,
        shift: userData.shift || existing.shift,
        photo_url: userData.photo_url || existing.photo_url,
        status: userData.status || existing.status || 'activo',
      });
      updatedCount++;
      continue;
    }

    await User.create({
      code: userData.code,
      full_name: userData.full_name,
      email: userData.email,
      password_hash,
      role: userData.role,
      phone: userData.phone,
      address: userData.address,
      job_title: userData.job_title,
      shift: userData.shift,
      photo_url: userData.photo_url,
      status: userData.status || 'activo',
    });

    console.log(`   🆕 Usuario '${userData.role}' creado: ${userData.email}`);
    createdCount++;
  }

  console.log(
    `🌱 Seeding de usuarios completado: ${createdCount} creado(s), ${updatedCount} actualizado(s).`,
  );
}
