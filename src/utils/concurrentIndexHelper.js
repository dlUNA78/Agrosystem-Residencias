const SAFE_IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const assertSafeIdentifier = (name, label) => {
  if (typeof name !== 'string' || !SAFE_IDENTIFIER_RE.test(name)) {
    throw new Error(`Identificador SQL inválido para ${label}: "${name}"`);
  }
  return name;
};

export const getIndexValidityState = async (
  queryInterface,
  indexName,
  schemaName = 'public',
) => {
  assertSafeIdentifier(indexName, 'indexName');
  assertSafeIdentifier(schemaName, 'schemaName');

  const [rows] = await queryInterface.sequelize.query(
    `SELECT i.relname AS index_name, ix.indisvalid, ix.indisready
     FROM pg_index ix
     JOIN pg_class i ON i.oid = ix.indexrelid
     JOIN pg_namespace n ON n.oid = i.relnamespace
     WHERE n.nspname = :schemaName
       AND i.relname = :indexName`,
    {
      replacements: { schemaName, indexName },
    },
  );

  if (!rows || rows.length === 0) {
    return { exists: false, isValid: false, isReady: false };
  }

  return {
    exists: true,
    isValid: rows[0].indisvalid === true,
    isReady: rows[0].indisready === true,
  };
};

export const dropConcurrentIndex = async (
  queryInterface,
  indexName,
  schemaName = 'public',
) => {
  assertSafeIdentifier(indexName, 'indexName');
  assertSafeIdentifier(schemaName, 'schemaName');
  await queryInterface.sequelize.query(
    `DROP INDEX CONCURRENTLY IF EXISTS "${schemaName}"."${indexName}"`,
  );
};

export const ensureValidConcurrentIndex = async (
  queryInterface,
  { name, createSql, schemaName = 'public' },
) => {
  assertSafeIdentifier(name, 'indexName');
  assertSafeIdentifier(schemaName, 'schemaName');

  const current = await getIndexValidityState(queryInterface, name, schemaName);
  if (current.exists && current.isValid) {
    return { name, action: 'skipped_valid' };
  }

  const wasInvalid = current.exists && !current.isValid;
  if (wasInvalid) {
    await dropConcurrentIndex(queryInterface, name, schemaName);
  }

  await queryInterface.sequelize.query(createSql);

  const verified = await getIndexValidityState(
    queryInterface,
    name,
    schemaName,
  );
  if (!verified.exists || !verified.isValid) {
    throw new Error(
      `El índice "${name}" quedó inválido (indisvalid=${verified.isValid}) tras su creación.`,
    );
  }

  return { name, action: wasInvalid ? 'recreated_from_invalid' : 'created' };
};
