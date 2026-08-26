import bcrypt from 'bcrypt';

export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Users', null, {});

    const defaultPassword = await bcrypt.hash('123456', 10);
    const adminPassword = await bcrypt.hash('admin123', 10);

    await queryInterface.bulkInsert(
      'Users',
      [
        {
          code: 'USR-ADM-001',
          full_name: 'Administrador Principal',
          email: 'admin@agrosystem.com',
          password_hash: adminPassword,
          role: 'admin',
          phone: '6671234567',
          address: 'Av. Insurgentes Sur 1200, Culiacán, Sinaloa',
          job_title: 'Administrador del Sistema',
          shift: 'Matutino',
          photo_url:
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
          status: 'activo',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          code: 'USR-INF-002',
          full_name: 'Dr. Roberto Mendoza INIFAP',
          email: 'investigador@agrosystem.com',
          password_hash: defaultPassword,
          role: 'inifap',
          phone: '6679876543',
          address: 'Campo Experimental Valle de Culiacán, INIFAP',
          job_title: 'Investigador Fitosanitario Senior',
          shift: 'Completo',
          photo_url:
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
          status: 'activo',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          code: 'USR-INF-003',
          full_name: 'Ing. María Fernanda López',
          email: 'tecnico@agrosystem.com',
          password_hash: defaultPassword,
          role: 'inifap',
          phone: '6675551234',
          address: 'Estación de Sanidad Vegetal INIFAP',
          job_title: 'Técnico Agrónomo',
          shift: 'Matutino',
          photo_url:
            'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80',
          status: 'activo',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          code: 'USR-AGR-004',
          full_name: 'Juan Pérez el Agricultor',
          email: 'juan@agricultor.com',
          password_hash: defaultPassword,
          role: 'agricultor',
          phone: '6674448899',
          address: 'Ejido Bellavista Lote 12, Culiacán',
          job_title: 'Productor de Hortalizas',
          shift: 'Variable',
          photo_url:
            'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
          status: 'activo',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          code: 'USR-AGR-005',
          full_name: 'Carlos Ruiz Productor',
          email: 'agricultor@agrosystem.com',
          password_hash: defaultPassword,
          role: 'agricultor',
          phone: '6673332211',
          address: 'Valle del Fuerte Parcela 45, Los Mochis',
          job_title: 'Productor de Granos',
          shift: 'Variable',
          photo_url:
            'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=300&q=80',
          status: 'activo',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          code: 'USR-AGR-006',
          full_name: 'Farmer Expediente Test',
          email: 'farmer_expediente@agrosystem.com',
          password_hash: defaultPassword,
          role: 'agricultor',
          phone: '6671112233',
          address: 'Predio San José s/n',
          job_title: 'Agricultor Registrado',
          shift: 'Matutino',
          photo_url: null,
          status: 'activo',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      {},
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Users', null, {});
  },
};