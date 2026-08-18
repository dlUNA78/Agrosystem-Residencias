/**
 * Calcula el precio final exacto de un producto aplicando descuento e impuestos.
 * @param {number} price - Precio base del producto.
 * @param {number} discountPercent - Porcentaje de descuento (0 - 100).
 * @param {number} taxPercent - Porcentaje de impuesto / IVA (0 - 100).
 * @returns {number} Precio final redondeado a 2 decimales.
 */
export const calculateFinalPrice = (
  price,
  discountPercent = 0,
  taxPercent = 0,
) => {
  const base = Number(price) || 0;
  const discountAmount = base * ((Number(discountPercent) || 0) / 100);
  const discountedPrice = base - discountAmount;
  const taxAmount = discountedPrice * ((Number(taxPercent) || 0) / 100);
  const finalPrice = discountedPrice + taxAmount;
  return Math.round(finalPrice * 100) / 100;
};
