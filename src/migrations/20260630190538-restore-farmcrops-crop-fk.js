/**
 * Esta migración fue un parche histórico para restaurar la FK crop_id en FarmCrops,
 * que faltaba porque create-farm-crop corría antes que create-crop (orden de timestamps).
 * El problema de orden fue corregido renombrando create-farm-crop a 20260618015760.
 * Se conserva como no-op para no romper el historial de SequelizeMeta.
 */
export default {
  async up(_queryInterface, _Sequelize) {
    // no-op: la FK ya se crea correctamente en 20260618015760-create-farm-crop
  },
  async down(_queryInterface) {
    // no-op
  },
};