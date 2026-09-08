const SESSION_TABLE = 'session';
const SESSION_EXPIRE_INDEX = 'IDX_session_expire';

const getTableName = (table) =>
  typeof table === 'string' ? table : table?.tableName;

export default {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const sessionTableExists = tables.map(getTableName).includes(SESSION_TABLE);

    if (!sessionTableExists) {
      await queryInterface.createTable(SESSION_TABLE, {
        sid: {
          type: Sequelize.STRING,
          allowNull: false,
          primaryKey: true,
        },
        sess: {
          type: Sequelize.JSON,
          allowNull: false,
        },
        expire: {
          type: Sequelize.DATE,
          allowNull: false,
        },
      });
    }

    const indexes = await queryInterface.showIndex(SESSION_TABLE);
    if (!indexes.some((index) => index.name === SESSION_EXPIRE_INDEX)) {
      await queryInterface.addIndex(SESSION_TABLE, ['expire'], {
        name: SESSION_EXPIRE_INDEX,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable(SESSION_TABLE);
  },
};
