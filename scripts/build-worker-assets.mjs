import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");
const outputDir = join(projectRoot, "dist-worker");

const filesToCopy = [
  "index.html",
  "dev-tools.html",
  "admin.html",
  "favicon.ico",
  "icon-192.png",
  "icon-512.png",
  "apple-touch-icon.png",
  "manifest.json",
  "style.css",
  "dev-tools.css",
  "admin.css",
  "config.js",
  "schedule-core.js",
  "booking-data.js",
  "campaign-controls.js",
  "script.js",
  "dev-tools.js",
  "admin.js",
  "scripts/admin-entry-redirect.js",
];

const directoriesToCopy = [
  "assets",
];

function cleanOutputDirectory() {
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });
}

function copyProjectFile(relativePath) {
  const sourcePath = join(projectRoot, relativePath);
  const destinationPath = join(outputDir, relativePath);

  if (!existsSync(sourcePath)) {
    throw new Error(`No encontramos el archivo requerido para publicar el Worker: ${relativePath}`);
  }

  mkdirSync(dirname(destinationPath), { recursive: true });
  cpSync(sourcePath, destinationPath, { force: true });
}

function copyProjectDirectory(relativePath) {
  const sourcePath = join(projectRoot, relativePath);
  const destinationPath = join(outputDir, relativePath);

  if (!existsSync(sourcePath)) {
    throw new Error(`No encontramos el directorio requerido para publicar el Worker: ${relativePath}`);
  }

  mkdirSync(destinationPath, { recursive: true });

  for (const entry of readdirSync(sourcePath)) {
    const sourceEntryPath = join(sourcePath, entry);
    const destinationEntryPath = join(destinationPath, entry);
    const entryStats = statSync(sourceEntryPath);

    if (entryStats.isDirectory()) {
      copyProjectDirectory(join(relativePath, entry));
      continue;
    }

    mkdirSync(dirname(destinationEntryPath), { recursive: true });
    cpSync(sourceEntryPath, destinationEntryPath, { force: true });
  }
}

cleanOutputDirectory();
filesToCopy.forEach(copyProjectFile);
directoriesToCopy.forEach(copyProjectDirectory);

console.log(`Assets del Worker preparados en ${outputDir}`);
