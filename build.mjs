/**
 * build.mjs — esbuild 构建脚本
 *
 * 构建策略：
 *   src/tts/index.js     → esbuild bundle（需要注入 .env 密钥）
 *   src/*.js / src/*.css → 直接复制（已是 Anki media 命名格式，无需打包）
 *   src/assets/**        → 递归遍历所有文件，flat 复制到 Anki media
 *
 * 构建完成后将 dist/ 下所有文件复制到 Anki media 目录。
 */

import * as esbuild from "esbuild";
import {
  readFileSync,
  existsSync,
  readdirSync,
  copyFileSync,
  mkdirSync,
  statSync,
} from "fs";
import { join, extname } from "path";

// ── 读取 .env ────────────────────────────────────────────────

function loadEnv(path = ".env") {
  if (!existsSync(path)) {
    console.warn(
      `[build] Warning: ${path} not found — secrets will be empty strings`,
    );
    return {};
  }
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split("\n")
      .filter((line) => line.trim() && !line.startsWith("#"))
      .map((line) => {
        const [key, ...rest] = line.split("=");
        return [key.trim(), rest.join("=").trim()];
      }),
  );
}

// ── esbuild define map ───────────────────────────────────────

function toDefines(env) {
  return Object.fromEntries(
    Object.entries(env).map(([k, v]) => [
      `process.env.${k}`,
      JSON.stringify(v),
    ]),
  );
}

// ── 直接复制 src/ 根目录下的静态文件（js / css） ─────────────
// 只复制文件，不递归进子目录（子目录走 esbuild）

function copyStaticFiles(srcDir, distDir) {
  const EXTS = new Set([".js", ".css"]);
  for (const file of readdirSync(srcDir)) {
    const src = join(srcDir, file);
    if (statSync(src).isDirectory()) continue; // skip subdirs
    if (!EXTS.has(extname(file))) continue; // skip non-js/css
    copyFileSync(src, join(distDir, file));
    console.log(`[build] copy  ${src} → dist/${file}`);
  }
}

// ── 复制 dist/ → Anki media ─────────────────────────────────

function copyToAnki(distDir, ankiDir) {
  if (!existsSync(ankiDir)) {
    console.warn(`[build] Warning: Anki media dir not found: ${ankiDir}`);
    return;
  }
  for (const file of readdirSync(distDir)) {
    const src = join(distDir, file);
    const dest = join(ankiDir, file);
    copyFileSync(src, dest);
    console.log(`[build] anki  dist/${file} → ${dest}`);
  }
}

// ── 递归遍历 srcDir 下所有文件，flat 复制到 destDir ──────────
// 遇到子目录就递归进去，但 destDir 始终不变（不创建子目录）

function copyFilesFlat(srcDir, destDir) {
  if (!existsSync(srcDir)) {
    console.warn(`[build] Warning: assets dir not found: ${srcDir}`);
    return;
  }

  for (const entry of readdirSync(srcDir)) {
    const srcPath = join(srcDir, entry);

    if (statSync(srcPath).isDirectory()) {
      // 递归进入子目录，destDir 保持不变 → flat 输出
      copyFilesFlat(srcPath, destDir);
    } else {
      const destPath = join(destDir, entry);
      copyFileSync(srcPath, destPath);
      console.log(`[build] assets ${srcPath} → ${destPath}`);
    }
  }
}

// ── 主流程 ───────────────────────────────────────────────────

const isDev = process.argv.includes("--dev");
const distDir = "dist";
const ankiDir =
  "/Users/cary/Library/Application Support/Anki2/User 1/collection.media";
const env = loadEnv();

mkdirSync(distDir, { recursive: true });

// 1. Bundle src/tts/index.js
await esbuild.build({
  entryPoints: ["./src/tts/index.js"],
  outfile: join(distDir, "tts.bundle.js"),
  bundle: true,
  format: "iife",
  target: ["es2020"],
  minify: !isDev,
  sourcemap: isDev ? "inline" : false,
  external: ["lamejs"],
  define: toDefines(env),
});
console.log(
  `[build] bundle src/tts/index.js → dist/tts.bundle.js (${isDev ? "dev" : "prod"})`,
);

// 2. Copy static files at src/ root (font-changer.5.js, lookup.1.js, etc.)
copyStaticFiles("src", distDir);

// 3. Deploy everything in dist/ to Anki
copyToAnki(distDir, ankiDir);

// 4. 将 src/assets/ 下所有文件（递归 flat）直接复制到 Anki media
if (existsSync(ankiDir)) {
  copyFilesFlat("src/assets", ankiDir);
} else {
  console.warn(
    `[build] Warning: Anki media dir not found, skipping assets copy`,
  );
}
