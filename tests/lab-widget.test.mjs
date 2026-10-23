import test from 'node:test';
import assert from 'node:assert/strict';
import {renderWidgetPreview, renderWidgetDesktop} from '../dist/lab-widget.mjs';
import {getTicketProgress} from '../dist/ticket-model.mjs';

const through = count => Array.from({length: count}, (_, index) => index + 1);
const view = (count = 9, available = 12) => ({
  user: {completed: through(count)},
  availableEpisodes: through(available),
  progress: getTicketProgress(through(count)),
  now: '2026-10-15T19:00:00+08:00',
  drama: {title: '长安的荔枝'},
  summary: {next: {date: '2026-10-16', time: '18:00'}},
});

test('preview requires one add confirmation and provides no premature playback or app shortcuts', () => {
  const html = renderWidgetPreview(view());
  assert.equal((html.match(/<button\b/g) || []).length, 2);
  assert.equal((html.match(/data-lab-widget-add/g) || []).length, 1);
  assert.equal((html.match(/data-lab-widget-penguin/g) || []).length, 1);
  assert.match(html, />添加到桌面<\/button>/);
  assert.doesNotMatch(html, /data-lab-widget-open|data-lab-play|data-episode|lab-widget-apps|效果预览|当前网页|正式上线|体验点击/);
});

test('confirmed desktop contains exactly one actual widget entry without serialized episode permission', () => {
  const html = renderWidgetDesktop(view());
  assert.match(html, /lab-widget-desktop/);
  assert.equal((html.match(/<button\b/g) || []).length, 2);
  assert.equal((html.match(/data-lab-widget-open/g) || []).length, 1);
  assert.equal((html.match(/data-lab-widget-penguin/g) || []).length, 1);
  assert.match(html, /aria-label="长安的荔枝，继续看第 10 集"/);
  assert.match(html, /腾讯视频/);
  assert.doesNotMatch(html, /data-lab-widget-add|data-lab-play|data-episode|原生|安装成功|lab-widget-apps/);
});

test('penguin interaction and desktop return are separate sibling buttons, never nested', () => {
  for (const render of [renderWidgetPreview, renderWidgetDesktop]) {
    const html = render(view());
    assert.match(html, /<div class="lab-widget-card"/);
    let depth = 0;
    for (const [tag] of html.matchAll(/<\/?button\b[^>]*>/g)) {
      depth += tag.startsWith('</') ? -1 : 1;
      assert.ok(depth >= 0 && depth <= 1, 'buttons must not be nested');
    }
    assert.equal(depth, 0);
    const penguin = html.match(/<button\b[^>]*data-lab-widget-penguin[^>]*>([\s\S]*?)<\/button>/)?.[1];
    assert.ok(penguin, 'decorative artwork must be inside its own actionable button');
    assert.match(penguin, /qq-companion-sleep\.png/);
    assert.match(penguin, /class="lab-widget-reaction" role="status" aria-live="polite"><\/span>/);
    assert.doesNotMatch(penguin, /data-lab-widget-open|data-lab-widget-add|data-lab-play/);
    assert.match(html, /aria-label="戳戳桌面企鹅" title="戳戳企鹅"/);
  }
  const desktop = renderWidgetDesktop(view());
  assert.match(desktop, /class="lab-widget-open"[^>]*data-lab-widget-open[^>]*>[\s\S]*?<\/button><button[^>]*data-lab-widget-penguin/);
});

test('widget retains all four earned penguin poses in both stages', () => {
  for (const [count, state] of [[9, 'sleep'], [10, 'awake'], [18, 'proud'], [30, 'celebrate']]) {
    for (const render of [renderWidgetPreview, renderWidgetDesktop]) {
      assert.match(render(view(count, 30)), new RegExp(`qq-companion-${state}\\.png`));
    }
  }
});

test('pending copy follows distinct available episodes, preserving gaps in watching history', () => {
  const data = view();
  data.user.completed = [1, 2, 5, 6];
  data.availableEpisodes = [6, 3, 2, 3, 4, 1, 5, '7', -1, 99, null];
  const before = structuredClone(data);
  const html = renderWidgetDesktop(data);
  assert.match(html, /还有 2 集，等你一起看/);
  assert.match(html, /从第 3 集继续，企鹅陪你/);
  assert.deepEqual(data, before);
});

test('caught-up and fully finished users are sent back to the calendar without invented next episodes', () => {
  const caughtUp = renderWidgetDesktop(view(12, 12));
  assert.match(caughtUp, /已追平，歇一歇/);
  assert.match(caughtUp, /10月16日 18:00 再相见/);
  assert.match(caughtUp, /长安的荔枝，打开追剧日历/);
  assert.doesNotMatch(caughtUp, /从第|继续看第/);
  const complete = renderWidgetDesktop(view(30, 30));
  assert.match(complete, /这一程，圆满啦/);
  assert.match(complete, /典藏电子票已为你收好/);
  assert.doesNotMatch(complete, /31 集|还差|继续看第/);
});

test('clock uses Beijing time for both UTC and offset inputs', () => {
  const data = view();
  assert.match(renderWidgetPreview(data), /19:00/);
  data.now = '2026-10-15T11:00:00Z';
  const html = renderWidgetPreview(data);
  assert.match(html, /19:00/);
  assert.match(html, /10月15日 星期四/);
});

test('untrusted title is escaped and invalid schedule fields cannot inject content', () => {
  const data = view(12, 12);
  data.drama.title = '<img src=x onerror="alert(1)"> & \'票\'';
  data.summary.next = {date: '<script>', time: '<script>'};
  data.now = '<script>';
  const html = renderWidgetDesktop(data);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt; &amp; &#39;票&#39;/);
  assert.match(html, /--:--/);
  assert.match(html, /打开日历，看看更新安排/);
  assert.doesNotMatch(html, /<script|<img src=x|onerror="/);
});

test('missing or malformed view shapes render a safe calendar entry', () => {
  for (const data of [undefined, null, {}, {user: null, availableEpisodes: {}, progress: {currentLevel: 99}}]) {
    for (const render of [renderWidgetPreview, renderWidgetDesktop]) {
      const html = render(data);
      assert.match(html, /qq-companion-sleep\.png/);
      assert.doesNotMatch(html, /undefined|null|NaN|典藏电子票已为你收好/);
    }
  }
  const data = view(12, 12);
  data.summary.next = {date: '2026-02-31', time: '18:00'};
  assert.doesNotMatch(renderWidgetDesktop(data), /2月31日/);
});
