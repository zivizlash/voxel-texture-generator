import { BLOCKS } from './palettes.js';
import { CLIENT_ENGINE_SCRIPT } from './client-engine.js';

/**
 * Генератор HTML-витрины для визуальной проверки текстур, интерактивной генерации,
 * настройки параметров fBm и Domain Warping, сборки текстурного атласа 8x8 и экспорта.
 */
export function generateViewerHtml({
  runDate = 'Live Web Session',
  seed = 1337,
  blocksData = null,
  initialParams = {}
}) {
  const {
    octaves = 3,
    warpStrength = 0.5,
    scale = 1.0,
    ditherStrength = 1.0,
    lightStrength = 1.0
  } = initialParams;

  const categories = {
    granular: {
      title: 'Сыпучие и пластичные материалы',
      desc: 'Высокочастотный зернистый шум, микро-гранулы, мягкие дюнные перепады'
    },
    organic: {
      title: 'Органика и почвы',
      desc: 'Рыхлая земля, прожилки корней, каменистые включения, споры и хвойный опад'
    },
    stone: {
      title: 'Каменные и магматические породы',
      desc: 'Угловатые сколы Voronoi, трещины, кварцевые и амфиболовые кристаллы'
    },
    layered: {
      title: 'Слоистые и спрессованные породы',
      desc: 'Горизонтальные пласты, волны сланцеватости, теневые швы и ступени'
    }
  };

  const allBlocks = blocksData ? blocksData.map(d => d.block) : Object.values(BLOCKS);

  const categorized = {};
  for (const block of allBlocks) {
    const cat = block.template || 'other';
    if (!categorized[cat]) categorized[cat] = [];
    categorized[cat].push(block);
  }

  const sectionsHtml = Object.entries(categories).map(([catKey, catMeta]) => {
    const blocks = categorized[catKey] || [];
    if (blocks.length === 0) return '';

    const cardsHtml = blocks.map(block => {
      const paletteSwatches = block.palette.map(c =>
        `<span class="swatch" style="background: rgb(${c.r},${c.g},${c.b})" title="RGB(${c.r}, ${c.g}, ${c.b})"></span>`
      ).join('');

      const variantsHtml = [1, 2, 3, 4, 5].map(v => {
        const staticSrc = `textures/${block.id}_var${v}.png`;
        return `
          <div class="variant-item" id="varItem_${block.id}_${v}" onclick="window.inspectTileByKey('${block.id}', ${v})">
            <div class="variant-top-bar" onclick="event.stopPropagation()">
              <input type="checkbox" class="variant-checkbox" id="chk_${block.id}_${v}" data-block-id="${block.id}" data-var="${v}" checked onchange="window.updateAtlasCounter()" title="Включить этот вариант в текстурный атлас">
              <span class="v-label">#${v}</span>
            </div>
            <img class="pixel-art" id="varImg_${block.id}_${v}" src="${staticSrc}" alt="${block.nameRu} #${v}" onerror="this.onerror=null;">
          </div>
        `;
      }).join('');

      return `
        <div class="block-card" id="card_${block.id}">
          <div class="card-header">
            <div class="card-title-group">
              <div class="title-row">
                <h3>${block.nameRu}</h3>
                <span class="category-tag">${block.template}</span>
              </div>
              <code class="block-id">${block.id}</code>
            </div>
            <div class="card-actions">
              <div class="palette-bar" title="Палитра материала (от тени к блику)">
                ${paletteSwatches}
              </div>
              <button class="icon-btn" onclick="window.downloadBlockVariants('${block.id}')" title="Скачать все варианты этого блока (.png)">
                ⬇
              </button>
            </div>
          </div>
          <div class="variants-row" id="variantsRow_${block.id}">
            ${variantsHtml}
          </div>
        </div>
      `;
    }).join('\n');

    return `
      <section class="category-section" id="cat_${catKey}">
        <div class="category-header">
          <div>
            <h2>${catMeta.title}</h2>
            <p class="category-desc">${catMeta.desc}</p>
          </div>
          <span class="category-count">${blocks.length} материалов</span>
        </div>
        <div class="cards-grid">
          ${cardsHtml}
        </div>
      </section>
    `;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>16x16 Procedural Texture Generator & Atlas</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0d0e12;
      --card-bg: #15161c;
      --card-hover: #191b22;
      --surface: #1d1e26;
      --border: #2b2d38;
      --border-focus: #58a6ff;
      --text: #f0f2f8;
      --text-dim: #9294a0;
      --text-sub: #6e707c;
      --accent: #3b82f6;
      --accent-gradient: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      --accent-hover: #1d4ed8;
      --accent-glow: rgba(59, 130, 246, 0.35);
      --atlas-gradient: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
      --atlas-glow: rgba(139, 92, 246, 0.35);
      --success: #10b981;
      --success-bg: rgba(16, 185, 129, 0.12);
      --success-border: rgba(16, 185, 129, 0.3);
      --warning-bg: rgba(245, 158, 11, 0.12);
      --warning-border: rgba(245, 158, 11, 0.3);
      --amber: #f59e0b;
      --radius-sm: 6px;
      --radius-md: 10px;
      --radius-lg: 14px;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background-color: var(--bg);
      background-image: 
        radial-gradient(at 0% 0%, rgba(37, 99, 235, 0.08) 0px, transparent 50%),
        radial-gradient(at 100% 100%, rgba(139, 92, 246, 0.06) 0px, transparent 50%);
      background-attachment: fixed;
      color: var(--text);
      font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 0 0 60px 0;
      line-height: 1.5;
      min-height: 100vh;
    }

    /* Верхняя фиксированная панель */
    .top-navbar {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(13, 14, 18, 0.92);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border-bottom: 1px solid var(--border);
      padding: 14px 28px;
    }

    .navbar-container {
      max-width: 1400px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .brand-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-icon {
      width: 36px;
      height: 36px;
      background: var(--accent-gradient);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 19px;
      box-shadow: 0 4px 12px var(--accent-glow);
    }

    .brand h1 {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #fff;
    }

    .brand-sub {
      font-size: 12px;
      color: var(--text-dim);
      font-weight: 500;
    }

    .nav-stats {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .badge {
      background: #191b22;
      border: 1px solid var(--border);
      padding: 4px 10px;
      border-radius: var(--radius-sm);
      font-size: 12px;
      color: var(--text-dim);
      font-family: 'JetBrains Mono', monospace;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .badge b { color: var(--text); }
    .badge.badge-success {
      background: var(--success-bg);
      border-color: var(--success-border);
      color: #34d399;
    }
    .badge.badge-warning {
      background: var(--warning-bg);
      border-color: var(--warning-border);
      color: #fbbf24;
    }
    .badge.badge-accent {
      background: rgba(139, 92, 246, 0.12);
      border-color: rgba(139, 92, 246, 0.3);
      color: #c084fc;
    }

    /* Панель управления */
    .controls-panel {
      display: flex;
      align-items: center;
      gap: 10px;
      background: var(--card-bg);
      padding: 10px 14px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
      flex-wrap: wrap;
    }

    .input-label-group {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #0f1015;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 2px 8px;
      transition: border-color 0.2s, box-shadow 0.2s;
      flex: 1;
      min-width: 200px;
    }

    .input-label-group:focus-within {
      border-color: var(--border-focus);
      box-shadow: 0 0 0 2px var(--accent-glow);
    }

    .input-label-group label {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .seed-input {
      background: transparent;
      border: none;
      outline: none;
      color: #fff;
      font-family: 'JetBrains Mono', monospace;
      font-size: 14px;
      font-weight: 600;
      padding: 6px 4px;
      width: 100%;
    }

    .seed-input::placeholder {
      color: var(--text-sub);
      font-family: 'Outfit', sans-serif;
      font-weight: 400;
    }

    .variants-group {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .variants-select {
      background: #0f1015;
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 7px 10px;
      font-family: 'Outfit', sans-serif;
      font-size: 13px;
      font-weight: 500;
      outline: none;
      cursor: pointer;
      transition: border-color 0.15s;
    }

    .variants-select:focus {
      border-color: var(--border-focus);
    }

    /* Кнопки */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 8px 14px;
      border-radius: var(--radius-sm);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.18s ease;
      border: none;
      outline: none;
      user-select: none;
      white-space: nowrap;
    }

    .btn-secondary {
      background: #1f212a;
      color: var(--text);
      border: 1px solid var(--border);
    }

    .btn-secondary:hover, .btn-secondary.active {
      background: #282a36;
      border-color: var(--accent);
      transform: translateY(-1px);
    }

    .btn-primary {
      background: var(--accent-gradient);
      color: #fff;
      box-shadow: 0 4px 14px var(--accent-glow);
    }

    .btn-primary:hover {
      filter: brightness(1.12);
      box-shadow: 0 6px 20px var(--accent-glow);
      transform: translateY(-1px);
    }

    .btn-atlas {
      background: var(--atlas-gradient);
      color: #fff;
      box-shadow: 0 4px 14px var(--atlas-glow);
    }

    .btn-atlas:hover {
      filter: brightness(1.12);
      box-shadow: 0 6px 20px var(--atlas-glow);
      transform: translateY(-1px);
    }

    .btn-tiny {
      padding: 4px 8px;
      font-size: 11px;
      font-weight: 600;
      border-radius: 4px;
      background: #1e2028;
      color: var(--text-dim);
      border: 1px solid var(--border);
      cursor: pointer;
      transition: all 0.15s;
    }

    .btn-tiny:hover {
      background: #2b2e3a;
      color: #fff;
      border-color: #555866;
    }

    .btn-glow {
      box-shadow: 0 0 16px var(--accent-glow);
    }

    .btn-loading {
      opacity: 0.8;
      pointer-events: none;
      filter: grayscale(0.2);
    }

    .atlas-controls-bar {
      display: flex;
      align-items: center;
      gap: 6px;
      padding-left: 8px;
      border-left: 1px solid var(--border);
    }

    .atlas-controls-bar .atlas-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-sub);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-right: 2px;
    }

    /* Панель продвинутых настроек шума (fBm & Domain Warping) */
    .noise-drawer {
      background: #14151b;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      box-shadow: 0 12px 30px rgba(0,0,0,0.4);
      animation: modalFadeIn 0.2s ease-out;
      transition: all 0.25s ease;
    }

    .noise-drawer.collapsed {
      display: none;
    }

    .noise-drawer-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
    }

    .noise-drawer-title {
      font-size: 14px;
      font-weight: 700;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .presets-bar {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    .presets-bar span {
      font-size: 11px;
      color: var(--text-dim);
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.04em;
      margin-right: 2px;
    }

    .sliders-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 14px 20px;
      background: #0f1015;
      padding: 14px 18px;
      border-radius: var(--radius-sm);
      border: 1px solid rgba(255, 255, 255, 0.04);
    }

    .slider-item {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .slider-item-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
    }

    .slider-item-header label {
      font-weight: 600;
      color: var(--text);
    }

    .slider-val-badge {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      font-weight: 700;
      color: var(--accent);
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid rgba(59, 130, 246, 0.25);
      padding: 1px 6px;
      border-radius: 4px;
    }

    .custom-range {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 6px;
      border-radius: 3px;
      background: #252834;
      outline: none;
      cursor: pointer;
    }

    .custom-range::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: var(--accent);
      box-shadow: 0 0 8px var(--accent-glow);
      cursor: pointer;
      transition: transform 0.1s;
    }

    .custom-range::-webkit-slider-thumb:hover {
      transform: scale(1.2);
    }

    .slider-desc {
      font-size: 11px;
      color: var(--text-sub);
      line-height: 1.2;
    }

    .theory-box {
      background: #111217;
      border-left: 3px solid var(--accent);
      padding: 8px 12px;
      border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
      font-size: 12px;
      color: var(--text-dim);
      line-height: 1.4;
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }

    /* Основное содержимое */
    main {
      max-width: 1400px;
      margin: 24px auto 0;
      padding: 0 28px;
    }

    .category-section {
      margin-bottom: 40px;
    }

    .category-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-bottom: 16px;
      padding-bottom: 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }

    .category-header h2 {
      font-size: 18px;
      font-weight: 700;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .category-desc {
      font-size: 13px;
      color: var(--text-dim);
      margin-top: 2px;
    }

    .category-count {
      font-size: 12px;
      font-family: 'JetBrains Mono', monospace;
      color: var(--text-sub);
    }

    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
      gap: 16px;
    }

    .block-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
    }

    .block-card:hover {
      border-color: #3b3e4f;
      background: var(--card-hover);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
    }

    .card-title-group {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .title-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .card-title-group h3 {
      font-size: 16px;
      font-weight: 700;
      color: #fff;
    }

    .category-tag {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      background: #1f212a;
      color: var(--text-dim);
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 600;
    }

    .block-id {
      font-size: 12px;
      color: var(--text-sub);
      font-family: 'JetBrains Mono', monospace;
    }

    .card-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .palette-bar {
      display: flex;
      gap: 2px;
      padding: 3px;
      background: #0d0e12;
      border-radius: 5px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .swatch {
      width: 13px;
      height: 13px;
      border-radius: 2px;
      display: inline-block;
      cursor: help;
    }

    .variants-row {
      display: flex;
      gap: 10px;
      background: #0f1015;
      padding: 10px;
      border-radius: var(--radius-sm);
      border: 1px solid rgba(255, 255, 255, 0.03);
      overflow-x: auto;
    }

    .variant-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      padding: 6px;
      border-radius: 6px;
      transition: background 0.15s, transform 0.12s, box-shadow 0.12s;
      position: relative;
    }

    .variant-item:hover {
      background: #232532;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    }

    .variant-top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: 0 2px;
      gap: 4px;
    }

    .variant-checkbox {
      appearance: none;
      -webkit-appearance: none;
      width: 14px;
      height: 14px;
      border: 1.5px solid #4a4d5e;
      border-radius: 3px;
      background: #15161d;
      cursor: pointer;
      outline: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
      vertical-align: middle;
    }

    .variant-checkbox:hover {
      border-color: var(--accent);
      background: #1c1e28;
    }

    .variant-checkbox:checked {
      background: var(--accent);
      border-color: var(--accent);
    }

    .variant-checkbox:checked::after {
      content: '✓';
      font-size: 10px;
      font-weight: 800;
      color: #fff;
      line-height: 1;
    }

    .pixel-art {
      width: 56px;
      height: 56px;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
      border: 1px solid #333644;
      border-radius: 4px;
      background: #000;
      transition: border-color 0.15s;
    }

    .variant-item:hover .pixel-art {
      border-color: var(--accent);
    }

    .v-label {
      font-size: 11px;
      font-family: 'JetBrains Mono', monospace;
      color: var(--text-dim);
    }

    /* Модальные окна */
    .modal-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 1000;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }

    .modal {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 24px;
      max-width: 580px;
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 16px;
      box-shadow: 0 24px 50px rgba(0, 0, 0, 0.75);
      animation: modalFadeIn 0.2s ease-out;
    }

    .modal.atlas-modal {
      max-width: 680px;
    }

    @keyframes modalFadeIn {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: scale(1); }
    }

    .modal-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }

    .modal-top h3 {
      font-size: 18px;
      font-weight: 700;
      color: #fff;
    }

    .modal-subtext {
      font-size: 13px;
      color: var(--text-dim);
      margin-top: 2px;
      line-height: 1.4;
    }

    .modal-subtext b {
      color: var(--text);
    }

    .close-btn {
      background: none;
      border: none;
      color: var(--text-dim);
      font-size: 24px;
      cursor: pointer;
      line-height: 1;
      padding: 4px;
    }

    .close-btn:hover { color: #fff; }

    /* Окно тайлинга 3x3 */
    .tiling-viewport {
      display: flex;
      justify-content: center;
      align-items: center;
      background: #08090b;
      padding: 24px;
      border-radius: var(--radius-md);
      border: 1px dashed var(--border);
      min-height: 330px;
    }

    .tiling-canvas {
      display: grid;
      grid-template-columns: repeat(3, 96px);
      grid-template-rows: repeat(3, 96px);
      width: 288px;
      height: 288px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
      transition: width 0.2s, height 0.2s;
    }

    .tiling-canvas.show-grid img {
      outline: 1px solid rgba(59, 130, 246, 0.45);
    }

    .tiling-canvas img {
      width: 96px;
      height: 96px;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
      display: block;
    }

    /* Окно атласа 8x8 */
    .atlas-viewport {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #08090b;
      padding: 20px;
      border-radius: var(--radius-md);
      border: 1px dashed var(--border);
      min-height: 400px;
      position: relative;
    }

    .atlas-canvas-wrapper {
      position: relative;
      width: 512px;
      height: 512px;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.65);
      background: 
        repeating-conic-gradient(#14151a 0% 25%, #1a1b22 0% 50%) 
        50% / 32px 32px;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 4px;
      overflow: hidden;
      cursor: crosshair;
    }

    .atlas-canvas {
      width: 512px;
      height: 512px;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
      display: block;
    }

    .atlas-grid-overlay {
      display: none;
      position: absolute;
      inset: 0;
      grid-template-columns: repeat(8, 1fr);
      grid-template-rows: repeat(8, 1fr);
      pointer-events: none;
    }

    .atlas-grid-overlay.show-grid {
      display: grid;
    }

    .atlas-grid-overlay::before {
      content: '';
      position: absolute;
      inset: 0;
      background-size: calc(100% / 8) calc(100% / 8);
      background-image:
        linear-gradient(to right, rgba(139, 92, 246, 0.4) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(139, 92, 246, 0.4) 1px, transparent 1px);
    }

    .atlas-tooltip {
      margin-top: 10px;
      font-size: 12px;
      font-family: 'JetBrains Mono', monospace;
      color: var(--text-dim);
      background: #121319;
      padding: 4px 12px;
      border-radius: 4px;
      border: 1px solid var(--border);
    }

    .atlas-tooltip b {
      color: #c084fc;
    }

    .modal-controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
      color: var(--text-dim);
      flex-wrap: wrap;
      gap: 10px;
    }

    .modal-left-controls {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }

    .modal-actions-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .toggle-label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      user-select: none;
    }

    .zoom-select {
      background: #0f1015;
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 5px 8px;
      font-size: 12px;
      outline: none;
      font-family: 'Outfit', sans-serif;
    }

    .toast-notification {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #1e2029;
      color: #fff;
      padding: 10px 18px;
      border-radius: var(--radius-sm);
      border: 1px solid #3b82f6;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5), 0 0 12px rgba(59, 130, 246, 0.3);
      font-size: 13px;
      font-weight: 500;
      z-index: 2000;
      opacity: 0;
      transform: translateY(12px);
      pointer-events: none;
      transition: opacity 0.2s, transform 0.2s;
    }

    .toast-notification.visible {
      opacity: 1;
      transform: translateY(0);
    }

    .icon-btn {
      background: transparent;
      border: 1px solid transparent;
      color: var(--text-dim);
      border-radius: 4px;
      padding: 4px 6px;
      cursor: pointer;
      font-size: 13px;
      transition: all 0.15s;
    }

    .icon-btn:hover {
      background: #252834;
      color: #fff;
      border-color: var(--border);
    }

    @media (max-width: 900px) {
      .top-navbar { padding: 12px 16px; }
      main { padding: 0 16px; }
      .cards-grid { grid-template-columns: 1fr; }
      .controls-panel { flex-direction: column; align-items: stretch; }
      .atlas-controls-bar { border-left: none; padding-left: 0; border-top: 1px solid var(--border); padding-top: 8px; }
      .btn { width: 100%; }
      .atlas-canvas-wrapper { width: 320px; height: 320px; }
      .atlas-canvas { width: 320px; height: 320px; }
    }
  </style>
</head>
<body>
  <header class="top-navbar">
    <div class="navbar-container">
      <div class="brand-row">
        <div class="brand">
          <div class="brand-icon">▦</div>
          <div>
            <h1>16x16 Texture Generator</h1>
            <div class="brand-sub">Процедурный генератор пиксельных текстур • fBm • Domain Warping • Атлас 8×8</div>
          </div>
        </div>
        <div class="nav-stats">
          <span class="badge">Сид: <b id="activeSeedBadge">${seed}</b></span>
          <span class="badge">Вариантов: <b id="activeVariantsBadge">5</b></span>
          <span class="badge" id="atlasCountBadge">🗺️ В атлас: <b id="atlasSelectedCount">80</b></span>
          <span class="badge badge-success" id="statusBadge">✓ Готов</span>
        </div>
      </div>

      <div class="controls-panel">
        <div class="input-label-group">
          <label for="seedInput">Сид:</label>
          <input 
            id="seedInput" 
            type="text" 
            value="${seed}" 
            placeholder="Введите число или текст (например: 1337, desert, ruby)..." 
            autocomplete="off" 
            autocorrect="off" 
            spellcheck="false"
            class="seed-input"
          />
        </div>

        <button id="randomSeedBtn" type="button" class="btn btn-secondary" title="Сгенерировать случайный сид (Горячая клавиша: R)">
          🎲 Случайный
        </button>

        <div class="variants-group">
          <select id="variantsSelect" class="variants-select" title="Количество вариантов для каждого блока">
            <option value="3">3 вар./блок</option>
            <option value="4">4 вар./блок</option>
            <option value="5" selected>5 вар./блок</option>
            <option value="6">6 вар./блок</option>
            <option value="8">8 вар./блок</option>
          </select>
        </div>

        <!-- Кнопка раскрытия настроек шума -->
        <button id="toggleSettingsBtn" type="button" class="btn btn-secondary active" onclick="window.toggleSettingsPanel()" title="Открыть/скрыть панель параметров шума (fBm, Domain Warp, Dither)">
          ⚙️ Параметры шума
        </button>

        <button id="generateBtn" type="button" class="btn btn-primary" title="Мгновенно сгенерировать текстуры (Enter)">
          <span>⚡</span> Сгенерировать
        </button>

        <!-- Управление атласом и галочками -->
        <div class="atlas-controls-bar">
          <span class="atlas-label">Атлас:</span>
          <button type="button" class="btn btn-tiny" onclick="window.selectAllVariants(true)" title="Выбрать все варианты">✓ Все</button>
          <button type="button" class="btn btn-tiny" onclick="window.selectAllVariants(false)" title="Снять все отметки">✕ Снять</button>
          <button type="button" class="btn btn-tiny" onclick="window.selectFirst64Variants()" title="Выбрать ровно 64 текстуры для сетки 8х8">⭐ 64 шт</button>
          <button type="button" class="btn btn-tiny" onclick="window.selectOnePerBlock()" title="Выбрать по 1 варианту каждого из 16 материалов">1️⃣ По 1 шт</button>
          
          <button id="openAtlasBtn" type="button" class="btn btn-atlas" onclick="window.openAtlasModal()" title="Сформировать текстурный атлас 8х8 блоков для предпросмотра">
            🗺️ Преобразовать в атлас
          </button>
        </div>
      </div>

      <!-- Панель продвинутых параметров шума и рельефа (fBm & Domain Warping) -->
      <div id="advancedSettingsDrawer" class="noise-drawer">
        <div class="noise-drawer-top">
          <div class="noise-drawer-title">
            <span>⚙️ Продвинутые техники: fBm (Октавы), Domain Warping (Искажение) & Шейдинг</span>
          </div>
          <div class="presets-bar">
            <span>Пресеты:</span>
            <button type="button" class="btn btn-tiny" onclick="window.applyNoisePreset('balanced')" title="Сбалансированная фактура">🌿 Стандарт</button>
            <button type="button" class="btn btn-tiny" onclick="window.applyNoisePreset('warp')" title="Сильные завихрения и потоки">🌊 Завихрения</button>
            <button type="button" class="btn btn-tiny" onclick="window.applyNoisePreset('sharp')" title="Четкие сколы без искривлений">💎 Кристалл</button>
            <button type="button" class="btn btn-tiny" onclick="window.applyNoisePreset('smooth')" title="Мягкие переходы и минимум шума">☁️ Мягкий</button>
            <button type="button" class="btn btn-tiny" onclick="window.applyNoisePreset('retro')" title="Выраженный пиксельный дизеринг">🕹️ Ретро</button>
          </div>
        </div>

        <div class="sliders-grid">
          <!-- 1. Октавы fBm -->
          <div class="slider-item">
            <div class="slider-item-header">
              <label for="paramOctaves">Октавы fBm (Слои шума):</label>
              <span class="slider-val-badge" id="valOctaves">${octaves}</span>
            </div>
            <input type="range" id="paramOctaves" class="custom-range" min="1" max="6" step="1" value="${octaves}">
            <div class="slider-desc">1: макро-пятна • 2: вмятины • 3: рябь • 4+: пористость</div>
          </div>

          <!-- 2. Domain Warping -->
          <div class="slider-item">
            <div class="slider-item-header">
              <label for="paramWarp">Domain Warping (Искажение):</label>
              <span class="slider-val-badge" id="valWarp">${warpStrength.toFixed(1)}</span>
            </div>
            <input type="range" id="paramWarp" class="custom-range" min="0" max="2" step="0.1" value="${warpStrength}">
            <div class="slider-desc">Смещение сетки (x, y) через шум: завихрения, потеки, волокна</div>
          </div>

          <!-- 3. Масштаб частоты -->
          <div class="slider-item">
            <div class="slider-item-header">
              <label for="paramScale">Масштаб шума (Scale):</label>
              <span class="slider-val-badge" id="valScale">${scale.toFixed(1)}x</span>
            </div>
            <input type="range" id="paramScale" class="custom-range" min="0.5" max="2.0" step="0.1" value="${scale}">
            <div class="slider-desc">Частота базовой координатной сетки шума</div>
          </div>

          <!-- 4. Дизеринг Байера -->
          <div class="slider-item">
            <div class="slider-item-header">
              <label for="paramDither">Дизеринг Байера (Dithering):</label>
              <span class="slider-val-badge" id="valDither">${ditherStrength.toFixed(1)}x</span>
            </div>
            <input type="range" id="paramDither" class="custom-range" min="0" max="2.0" step="0.1" value="${ditherStrength}">
            <div class="slider-desc">Матрица 4×4: ликвидация плоских островков и зернистость</div>
          </div>

          <!-- 5. Направленный свет -->
          <div class="slider-item">
            <div class="slider-item-header">
              <label for="paramLight">Рельефный свет (Lighting):</label>
              <span class="slider-val-badge" id="valLight">${lightStrength.toFixed(1)}x</span>
            </div>
            <input type="range" id="paramLight" class="custom-range" min="0" max="2.0" step="0.1" value="${lightStrength}">
            <div class="slider-desc">Свет сверху-слева: псевдообъем и теневые углубления</div>
          </div>
        </div>

        <div class="theory-box">
          <div>💡 <b>Тороидальная бесшовность (Tiling):</b> все алгоритмы зациклены по модулю 16 (тор), поэтому даже при максимальном Domain Warping и 6 октавах края текстуры (верх-низ, лево-право) математически непрерывны и стыкуются идеально.</div>
        </div>
      </div>
    </div>
  </header>

  <main>
    ${sectionsHtml}
  </main>

  <!-- Модальное окно 1: Инспектор тайлинга 3x3 -->
  <div id="modalBackdrop" class="modal-backdrop" onclick="if(event.target === this) closeModal()">
    <div class="modal">
      <div class="modal-top">
        <div>
          <h3 id="modalTitle">Инспектор бесшовности (3x3 Тайлинг)</h3>
          <p class="modal-subtext">
            Матрица 3x3 для проверки тороидальной бесшовности стыков (верх-низ, лево-право).
          </p>
        </div>
        <button class="close-btn" onclick="closeModal()">&times;</button>
      </div>
      <div class="tiling-viewport">
        <div id="tilingCanvas" class="tiling-canvas"></div>
      </div>
      <div class="modal-controls">
        <div class="modal-left-controls">
          <label class="toggle-label">
            <input type="checkbox" id="gridToggle" onchange="toggleGrid(this.checked)">
            Сетка стыков
          </label>
          <select class="zoom-select" onchange="changeZoom(parseInt(this.value, 10))">
            <option value="400">400%</option>
            <option value="600" selected>600%</option>
            <option value="800">800%</option>
          </select>
        </div>
        <button id="modalDownloadBtn" class="btn btn-secondary" style="font-size: 12px; padding: 6px 12px;">
          💾 Скачать PNG (16x16)
        </button>
      </div>
    </div>
  </div>

  <!-- Модальное окно 2: Предпросмотр текстурного атласа 8x8 -->
  <div id="atlasModalBackdrop" class="modal-backdrop" onclick="if(event.target === this) window.closeAtlasModal()">
    <div class="modal atlas-modal">
      <div class="modal-top">
        <div>
          <h3 id="atlasModalTitle">Текстурный атлас 8×8 (128×128 px)</h3>
          <p class="modal-subtext" id="atlasModalSubtext">
            Сформирован из выбранных вариантов текстур
          </p>
        </div>
        <button class="close-btn" onclick="window.closeAtlasModal()">&times;</button>
      </div>

      <div class="atlas-viewport">
        <div class="atlas-canvas-wrapper" id="atlasWrapper">
          <canvas id="atlasCanvas" width="128" height="128" class="atlas-canvas"></canvas>
          <div id="atlasGridOverlay" class="atlas-grid-overlay show-grid"></div>
        </div>
        <div id="atlasHoverTooltip" class="atlas-tooltip">Наведите курсор на слот для информации о блоке</div>
      </div>

      <div class="modal-controls">
        <div class="modal-left-controls">
          <label class="toggle-label">
            <input type="checkbox" id="atlasGridToggle" checked onchange="window.toggleAtlasGrid(this.checked)">
            Сетка блоков 8×8
          </label>
          <select class="zoom-select" id="atlasZoomSelect" onchange="window.changeAtlasZoom(parseInt(this.value, 10))">
            <option value="2">Масштаб: 200% (256px)</option>
            <option value="4" selected>Масштаб: 400% (512px)</option>
            <option value="6">Масштаб: 600% (768px)</option>
          </select>
        </div>

        <div class="modal-actions-group">
          <button id="saveAtlasWithPickerBtn" type="button" class="btn btn-primary btn-glow" onclick="window.saveAtlasToFilePicker()">
            💾 Сохранить .png с выбором пути
          </button>
          <button type="button" class="btn btn-secondary" onclick="window.quickDownloadAtlas()" title="Скачать напрямую в папку загрузок">
            ⬇ Скачать
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Всплывающее уведомление Toast -->
  <div id="toastNotification" class="toast-notification"></div>

  <script>
${CLIENT_ENGINE_SCRIPT}
  </script>
</body>
</html>
`;
}
