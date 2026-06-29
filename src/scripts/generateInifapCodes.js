#!/usr/bin/env node
/**
 * Script de administración: Generador de códigos INIFAP
 * ──────────────────────────────────────────────────────
 * Uso desde terminal (en la raíz del proyecto):
 *
 *   node src/scripts/generateInifapCodes.js --count 5
 *   node src/scripts/generateInifapCodes.js --count 1 --note "Dr. Juan Pérez - Centro Michoacán"
 *   node src/scripts/generateInifapCodes.js --count 3 --expires 2026-12-31
 *
 * Opciones:
 *   --count   N           Número de códigos a generar (default: 1)
 *   --note    "texto"     Nota interna asociada al código
 *   --expires YYYY-MM-DD  Fecha de expiración (opcional)
 */

import "dotenv/config";
import crypto from "crypto";

// Tu index.js es asíncrono (usa await al nivel superior), así que el import
// espera a que todos los modelos estén registrados antes de continuar
import db from "../models/index.js";

const { InifapCode } = db;

// ── Parseo de argumentos CLI ─────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : null;
};

const count = parseInt(getArg("count") || "1", 10);
const note = getArg("note") || null;
const expiresRaw = getArg("expires") || null;
const expires_at = expiresRaw ? new Date(expiresRaw) : null;

// ── Validación de argumentos ─────────────────────────────────────────────────
if (isNaN(count) || count < 1) {
  console.error("❌ --count debe ser un número entero mayor a 0.");
  process.exit(1);
}

if (expiresRaw && isNaN(Date.parse(expiresRaw))) {
  console.error(
    "❌ --expires debe tener el formato YYYY-MM-DD (ej: 2026-12-31).",
  );
  process.exit(1);
}

// ── Generador de código alfanumérico seguro ──────────────────────────────────
// Formato: INIFAP-XXXX-XXXX  (ej: INIFAP-A3K9-7ZP2)
// Usa crypto.randomBytes → aleatoriedad criptográfica real
const generateCode = () => {
  const segment = () =>
    crypto.randomBytes(3).toString("hex").toUpperCase().slice(0, 4);
  return `INIFAP-${segment()}-${segment()}`;
};

// ── Ejecución principal ──────────────────────────────────────────────────────
(async () => {
  try {
    console.log(`\n🔐 Generando ${count} código(s) INIFAP...\n`);

    for (let i = 0; i < count; i++) {
      let code;
      let attempts = 0;

      // Reintenta si hay colisión de código (estadísticamente imposible, pero defensivo)
      do {
        code = generateCode();
        attempts++;
        if (attempts > 10)
          throw new Error(
            "No se pudo generar un código único tras 10 intentos.",
          );
      } while (await InifapCode.findOne({ where: { code } }));

      await InifapCode.create({ code, note, expires_at });

      console.log(
        `  ✅ ${code}` +
          (note ? `  →  "${note}"` : "") +
          (expires_at ? `  (expira: ${expiresRaw})` : ""),
      );
    }

    console.log(`\n📋 ${count} código(s) creado(s) exitosamente en la BD.`);
    console.log(
      "⚠️  Entrega estos códigos de forma segura a cada empleado INIFAP.",
    );
    console.log(
      "    Una vez canjeados, quedarán marcados como usados automáticamente.\n",
    );

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error al generar códigos:", error.message);
    process.exit(1);
  }
})();
