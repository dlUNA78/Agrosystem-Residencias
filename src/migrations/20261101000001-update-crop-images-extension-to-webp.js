export async function up(queryInterface) {
  await queryInterface.sequelize.query(`
    UPDATE "CropImages"
    SET
      image_url = REPLACE(image_url, '.jpg', '.webp'),
      original_name = REPLACE(original_name, '.jpg', '.webp')
    WHERE image_url LIKE '%.jpg' OR original_name LIKE '%.jpg';
  `);
}

export async function down(queryInterface) {
  await queryInterface.sequelize.query(`
    UPDATE "CropImages"
    SET
      image_url = REPLACE(image_url, '.webp', '.jpg'),
      original_name = REPLACE(original_name, '.webp', '.jpg')
    WHERE image_url LIKE '%.webp' OR original_name LIKE '%.webp';
  `);
}
