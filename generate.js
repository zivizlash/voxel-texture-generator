import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PRNG } from './src/prng.js';
import { BLOCKS } from './src/palettes.js';
import { encodePNG } from './src/png.js';
import { generateGranular } from './src/templates/granular.js';
import { generateOrganic } from './src/templates/organic.js';
import { generateStone } from './src/templates/stone.js';
import { generateLayered } from './src/templates/layered.js';
import { generateViewerHtml } from './src/viewer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Разбор аргументов командной строки
function parseArgs() {
  const args = process.argv.slice(2);
  let seed = 1337;
  let variantsCount = 5;
  let octaves = 3;
  let warpStrength = 0.5;
  let scale = 1.0;
  let ditherStrength = 1.0;
  let lightStrength = 1.0;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--seed' && args[i + 1]) {
      seed = parseInt(args[i + 1], 10) || PRNG.hashString(args[i + 1]);
      i++;
    } else if (args[i] === '--variants' && args[i + 1]) {
      variantsCount = parseInt(args[i + 1], 10) || 5;
      i++;
    } else if (args[i] === '--octaves' && args[i + 1]) {
      octaves = parseInt(args[i + 1], 10) || 3;
      i++;
    } else if (args[i] === '--warp' && args[i + 1]) {
      warpStrength = parseFloat(args[i + 1]) ?? 0.5;
      i++;
    } else if (args[i] === '--scale' && args[i + 1]) {
      scale = parseFloat(args[i + 1]) ?? 1.0;
      i++;
    } else if (args[i] === '--dither' && args[i + 1]) {
      ditherStrength = parseFloat(args[i + 1]) ?? 1.0;
      i++;
    } else if (args[i] === '--light' && args[i + 1]) {
      lightStrength = parseFloat(args[i + 1]) ?? 1.0;
      i++;
    }
  }

  return { seed, variantsCount, octaves, warpStrength, scale, ditherStrength, lightStrength };
}

// Форматирование текущей даты и времени для папки
function getTimestampFolder() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const min = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  return `${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}`;
}

async function main() {
  const { seed, variantsCount, octaves, warpStrength, scale, ditherStrength, lightStrength } = parseArgs();
  const timestamp = getTimestampFolder();

  const outputDir = path.join(__dirname, 'output', timestamp);
  const texturesDir = path.join(outputDir, 'textures');

  fs.mkdirSync(texturesDir, { recursive: true });

  console.log(`=======================================================`);
  console.log(`  16x16 Procedural Texture Generator`);
  console.log(`=======================================================`);
  console.log(`Базовый сид:     ${seed}`);
  console.log(`Вариантов/блок:  ${variantsCount}`);
  console.log(`Октавы fBm:      ${octaves}`);
  console.log(`Domain Warping:  ${warpStrength}`);
  console.log(`Масштаб (Scale): ${scale}x`);
  console.log(`Дизеринг:        ${ditherStrength}x`);
  console.log(`Освещение:       ${lightStrength}x`);
  console.log(`Папка генерации: ${outputDir}`);
  console.log(`-------------------------------------------------------\n`);

  const templateGenerators = {
    granular: generateGranular,
    organic: generateOrganic,
    stone: generateStone,
    layered: generateLayered
  };

  const blocksList = Object.values(BLOCKS);
  const reportData = [];

  let totalGenerated = 0;

  for (let bIndex = 0; bIndex < blocksList.length; bIndex++) {
    const block = blocksList[bIndex];
    const generatorFn = templateGenerators[block.template];

    if (!generatorFn) {
      console.warn(`[WARN] Шаблон "${block.template}" для блока ${block.id} не найден!`);
      continue;
    }

    const blockReport = {
      block,
      variants: []
    };

    process.stdout.write(`Генерация [${bIndex + 1}/${blocksList.length}] ${block.nameRu.padEnd(20)} (${block.id})... `);

    for (let v = 1; v <= variantsCount; v++) {
      // Детерминированный суб-сид для каждого варианта блока
      const subSeed = (seed + bIndex * 1000 + v * 13) >>> 0;
      const prng = new PRNG(subSeed);

      // Генерация 16x16 массива пикселей с учетом параметров fBm и Warp
      const pixelGrid = generatorFn(block, prng, 16, 16, {
        octaves,
        warpStrength,
        scale,
        ditherStrength,
        lightStrength
      });

      // Кодирование в валидный PNG файл
      const pngBuffer = encodePNG(16, 16, pixelGrid);

      const fileName = `${block.id}_var${v}.png`;
      const filePath = path.join(texturesDir, fileName);
      fs.writeFileSync(filePath, pngBuffer);

      blockReport.variants.push({
        index: v,
        fileName: `textures/${fileName}`,
        fullPath: filePath
      });

      totalGenerated++;
    }

    reportData.push(blockReport);
    process.stdout.write(`OK (${variantsCount} вар.)\n`);
  }

  // Создаем HTML-витрину для удобного просмотра и теста тайлинга 3x3
  const htmlContent = generateViewerHtml({
    runDate: timestamp,
    seed,
    blocksData: reportData,
    initialParams: { octaves, warpStrength, scale, ditherStrength, lightStrength }
  });

  const htmlPath = path.join(outputDir, 'index.html');
  fs.writeFileSync(htmlPath, htmlContent, 'utf8');

  console.log(`\n=======================================================`);
  console.log(`  Генерация успешно завершена!`);
  console.log(`  Всего текстур:  ${totalGenerated}`);
  console.log(`  Витрина HTML:   ${htmlPath}`);
  console.log(`=======================================================`);
}

main().catch(err => {
  console.error('Ошибка генерации:', err);
  process.exit(1);
});
