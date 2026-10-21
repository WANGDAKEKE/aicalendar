const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

const finishNames = {paper: '原色纸票', foil: '鎏金票面', holo: '流光票面'};

// The account's earned level is authoritative; choosing a tab only previews it.
export function renderTicketPanel({drama, progress, levels, selectedLevel, celebrate = false, firstTicket, available = 0, today = ''}) {
  const currentLevel = progress.currentLevel;
  const requestedLevel = Number(selectedLevel) || currentLevel || 1;
  const selected = levels.find(level => level.level === requestedLevel)
    || levels.find(level => level.level === (currentLevel || 1))
    || levels[0];
  if (!selected) return '';

  const hasTicket = currentLevel > 0;
  const isPreview = selected.level > currentLevel;
  const isCelebrating = celebrate && hasTicket && selected.level === currentLevel;
  const finish = ['paper', 'foil', 'holo'].includes(selected.finish) ? selected.finish : 'paper';
  const selectedName = escapeHTML(selected.name);
  const status = isPreview
    ? `票面预览 · ${hasTicket ? '尚未升级' : '未获得'}`
    : selected.level === currentLevel ? '当前票面 · 已获得' : '已解锁票面';
  const condition = `看完前 ${selected.episode} 集${selected.level === 1 ? '获得' : '升级'}`;
  const next = progress.next;
  const nextProgress = progress.nextProgress;
  const watched = nextProgress ? nextProgress.watchedCount : progress.watchedCount;
  const total = nextProgress ? nextProgress.total : drama.totalEpisodes;
  const percent = total > 0 ? Math.max(0, Math.min(100, watched / total * 100)) : 0;
  const nextEpisode = nextProgress?.nextEpisode;
  const canContinue = Number.isSafeInteger(nextEpisode) && nextEpisode > 0 && nextEpisode <= available;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(today) ? today.replaceAll('-', '.') : '';
  const earnedMessage = isCelebrating
    ? `<p class="ticket-earned">${(firstTicket ?? (currentLevel === 1)) ? '已获得' : '已升级为'}${escapeHTML(progress.current?.name || '')} · 已自动收好</p>`
    : '';
  const continueButton = (secondary = false) => `<button class="${secondary ? 'ticket-secondary' : 'ticket-primary'}" data-episode="${nextEpisode}">继续看第 ${nextEpisode} 集 <span aria-hidden="true">→</span></button>`;
  const action = isCelebrating
    ? `<button class="ticket-primary" data-close-reward>收好了</button>${canContinue ? continueButton(true) : ''}`
    : canContinue ? continueButton()
      : `<button class="ticket-primary" data-close-reward>回日历</button>`;

  return `<div class="ticket-panel${isCelebrating ? ' ticket-celebrating' : ''}">
    <div class="ticket-levels" role="group" aria-label="选择电子票票面">
      ${levels.map(level => `<button type="button" class="ticket-level${level.level > currentLevel ? ' is-locked' : ''}" data-ticket-level="${level.level}" aria-pressed="${level.level === selected.level}"><strong>${escapeHTML(level.name)}</strong><small>前 ${level.episode} 集 · ${level.level > currentLevel ? '未解锁' : '已解锁'}</small></button>`).join('')}
    </div>
    ${earnedMessage}
    <div class="ticket-preview-caption"><span>${status}</span><small>${condition}</small></div>
    <div class="ticket-stage">
      <article class="ticket-card ticket-finish-${finish}${isPreview ? ' is-preview' : ''}" aria-label="${escapeHTML(drama.title)}${selectedName}，${status}，${condition}">
        <div class="ticket-head"><span>追 剧 纪 念</span><span>${String(selected.level).padStart(2, '0')} / 03</span></div>
        <div class="ticket-poster" role="img" aria-label="${escapeHTML(drama.title)}剧集海报"><span class="ticket-poster-edge" aria-hidden="true"></span>${isPreview ? '<span class="ticket-preview-label">票面预览</span>' : ''}</div>
        <div class="ticket-main"><div class="ticket-name-row"><span>${selectedName}</span><small>${finishNames[finish]}</small></div><h3>${escapeHTML(drama.title)}</h3><div class="ticket-edition"><span>一颗荔枝 · 一路相伴</span><span aria-hidden="true">${finish === 'holo' ? '✦' : finish === 'foil' ? '✧' : '◇'}</span></div></div>
        <div class="ticket-stub"><div class="ticket-stub-top"><span>NO. <b>${hasTicket ? 'LY-0001' : '待生成'}</b></span><span>${date ? `进度 ${date}` : ''}</span></div><div class="ticket-barcode" aria-hidden="true"></div><p>追剧纪念票 · 非观影凭证</p></div>
      </article>
    </div>
    <div class="ticket-progress"><div class="ticket-progress-heading"><strong>${next ? `${hasTicket ? '下一次升级' : '即将获得'} · ${escapeHTML(next.name)}` : '全剧看完 · 典藏票已收好'}</strong><span>${watched}<em> / ${total} 集</em></span></div><div class="ticket-progress-track" role="progressbar" aria-label="${next ? `前 ${total} 集观看进度` : '全剧观看进度'}" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${watched}"><span style="width:${percent}%"></span></div><p>${next ? canContinue ? `再看完 ${nextProgress.remaining} 集，${hasTicket ? '票面自动升级' : '自动获得你的第一张票'}` : '继续追剧后自动升级' : '同一张票，记录完整的追剧旅程'}</p></div>
    ${action}
    <p class="ticket-auto-note">观看历史自动记录 · 非观影凭证</p>
  </div>`;
}
