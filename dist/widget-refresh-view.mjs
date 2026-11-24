const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character]));

const paths = Object.freeze({
  play: '<path d="m9 6 10 6-10 6Z" fill="currentColor" stroke="none"/>',
  arrow: '<path d="m9 5 7 7-7 7"/>',
  home: '<path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-7h6v7"/>',
  downloads: '<path d="M12 3v12m-5-5 5 5 5-5M4 14v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6"/>',
  calendar: '<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4m8-4v4M4 10h16m-11 5h.01M12 15h.01M16 15h.01"/>',
});

export function renderRefreshIcon(name, className = '') {
  return `<svg class="${escapeHTML(className)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.arrow}</svg>`;
}

function brand(label) {
  return `<span class="sr-brand"><img src="./assets/tencent/tencent-video-official-icon-192.png" alt="" width="192" height="192"><span>${escapeHTML(label)}</span></span>`;
}

function eyes(mood) {
  return `<span class="sr-eyes" data-mood="${escapeHTML(mood)}" aria-hidden="true"><i></i><i></i></span>`;
}

export function renderRefreshCard(study, variant = 'split') {
  if (!study || typeof study !== 'object') throw new TypeError('A refresh study is required.');
  if (!['split', 'poster'].includes(variant)) throw new TypeError('Unknown widget variant.');
  const title = escapeHTML(study.contentTitle);
  const action = study.action === 'resume' ? 'resume' : 'schedule';
  const label = escapeHTML(`${study.contentTitle}，${study.headline}，${study.updateLine}，${study.progressLine}，${study.actionLabel}`);
  const primaryIcon = action === 'resume' ? 'play' : 'calendar';
  const metadata = `data-scene="${escapeHTML(study.id)}" data-content-title="${title}" data-mood="${escapeHTML(study.mood)}"`;

  if (variant === 'split') {
    return `<article class="sr-card sr-split" ${metadata}>
      <button type="button" class="sr-split__poster" data-action="detail" aria-label="${title}，查看内容详情演示">
        <span class="sr-split__art" aria-hidden="true"></span>${brand('最近在看')}
        <span class="sr-split__title">${title}</span><span class="sr-split__genre">古装 · 剧情</span>
      </button>
      <div class="sr-split__controls">
        <button type="button" class="sr-split__continue" data-action="${action}" aria-label="${label}">
          <span class="sr-split__update"><span>${escapeHTML(study.updateLine)}</span>${eyes(study.mood)}</span>
          <span class="sr-split__headline">${escapeHTML(study.headline)}</span>
          <span class="sr-split__progress">${escapeHTML(study.progressLine)}${renderRefreshIcon('arrow')}</span>
        </button>
        <div class="sr-split__utilities"><button type="button" data-action="home" aria-label="进入首页演示">${renderRefreshIcon('home')}<span>进入首页</span></button><button type="button" data-action="downloads" aria-label="我的下载演示">${renderRefreshIcon('downloads')}<span>我的下载</span></button></div>
      </div>
    </article>`;
  }

  return `<article class="sr-card sr-poster" ${metadata}><button type="button" class="sr-poster__main" data-action="${action}" aria-label="${label}">
    <span class="sr-poster__art" aria-hidden="true"></span>
    <span class="sr-poster__top">${brand('腾讯视频')}<span class="sr-poster__status">${eyes(study.mood)}<span>${escapeHTML(study.updateLine)}</span></span></span>
    <span class="sr-poster__title">${title}</span>
    <span class="sr-poster__bottom"><span class="sr-poster__text"><span class="sr-poster__headline">${escapeHTML(study.headline)}</span><span class="sr-poster__progress">${escapeHTML(study.progressLine)}</span></span><span class="sr-poster__action">${renderRefreshIcon(primaryIcon)}<span>${escapeHTML(study.actionLabel)}</span></span></span>
  </button></article>`;
}

export function refreshActionDetails(study, action) {
  const entries = {
    resume: {title: '继续观看', body: `${study.contentTitle} · ${study.targetLabel}`, hint: '仅预览续播目标，不触发真实播放，也不增加观看记录。'},
    schedule: {title: '查看排期', body: `${study.contentTitle} · ${study.targetLabel}`, hint: '排期为虚构演示。正式承接需接入可信排播与客户端能力。'},
    detail: {title: '内容详情', body: study.contentTitle, hint: '海报与续看信息属于同一内容；这里仅演示详情入口。'},
    home: {title: '进入首页', body: '保留现有首页快捷入口', hint: '仅演示入口，不会打开腾讯视频客户端。'},
    downloads: {title: '我的下载', body: '保留现有下载快捷入口', hint: '仅演示入口，未接入实际下载记录，不会下载任何内容。'},
  };
  return Object.freeze(entries[action] ?? {title: '入口演示', body: study.contentTitle, hint: '未接入真实业务。'});
}

export { escapeHTML as escapeRefreshHTML };
