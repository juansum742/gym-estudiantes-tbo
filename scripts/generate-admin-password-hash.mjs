import { pbkdf2Sync, randomBytes } from "node:crypto";

const password = String(process.argv[2] || "").trim();

if (!password) {
  console.error("Uso: node scripts/generate-admin-password-hash.mjs \"tu-clave-admin\"");
  process.exit(1);
}

const iterations = 100000;
const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, iterations, 32, "sha256");

function toBase64Url(buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

console.log(`pbkdf2_sha256$${iterations}$${toBase64Url(salt)}$${toBase64Url(hash)}`);
