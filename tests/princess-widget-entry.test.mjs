import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrincessSession, selectPrincessCalendar} from '../dist/princess-calendar-model.mjs';
import {derivePrincessWidgetState, renderPrincessWidgetEntry, renderPrincessWidgetSetup} from '../dist/princess-widget-entry.mjs';

const defaultView = () => selectPrincessCalendar(createPrincessSession());

test('widget adapter uses the current entitled playable continuation, not a hardcoded episode', () => {
  const view = defaultView();
  const state = derivePrincessWidgetState(view);
  assert.equal(state.episode, 25);
  assert.equal(state.selection.target.episode, view.nextEpisode);
  assert.equal(state.selection.target.title, '尚公主');
  assert.equal(state.selection.status, 'resume');
  assert.equal(state.copy.key, 'ready');
  assert.equal(derivePrincessWidgetState({...view, nextEpisode: 26}).episode, 26);
  assert.equal(derivePrincessWidgetState({...view, nextEpisode: 99}).episode, null);
});

test('free, unknown and absent accounts do not get a fictional continuation', () => {
  for (const view of [
    selectPrincessCalendar(createPrincessSession({tier: 'free'})),
    {...defaultView(), accountTier: 'free'},
    {...defaultView(), accountTier: 'unknown'},
    {...defaultView(), accountTier: undefined},
    {},
  ]) {
    const state = derivePrincessWidgetState(view);
    assert.equal(state.canResume, false);
    assert.equal(state.episode, null);
    assert.equal(state.selection.target, null);
    assert.equal(state.selection.status, 'unavailable');
    const html = renderPrincessWidgetSetup(view, {stage: 'desktop'});
    assert.doesNotMatch(html, /第\s*25\s*集|25集|继续看第25/);
    assert.match(html, /当前暂无可续看的剧集/);
  }
});

test('caught-up poster presentation does not invent a next episode', () => {
  const view = {...defaultView(), nextEpisode: null};
  const state = derivePrincessWidgetState(view);
  assert.equal(state.selection.status, 'caught-up');
  assert.equal(state.selection.target, null);
  assert.equal(state.copy.key, 'resting');
  const html = renderPrincessWidgetSetup(view, {stage: 'desktop'});
  assert.match(html, /下次更新，等你一起/);
  assert.match(html, /已追平当前可看内容/);
  assert.doesNotMatch(html, /第\s*25\s*集|25集/);
});

test('compact entry shows the matching IP poster with exactly one accessible add action', () => {
  const html = renderPrincessWidgetEntry(defaultView());
  assert.match(html, /把追剧搭子放到桌面/);
  assert.match(html, /桌面看更新，一点接着看/);
  assert.match(html, /cpw-card/);
  assert.match(html, /data-ip="princess"/);
  assert.match(html, /cpw-mini-wrap/);
  assert.equal((html.match(/<button\b/g) || []).length, 1);
  assert.match(html, /data-action="desktop"[^>]*>添加<\/button>/);
  assert.doesNotMatch(html, /id=""|widget-v4|cpw-card__headline|cpw-card__context/);
});

test('previewed state says view and never claims an operating-system installation succeeded', () => {
  const html = renderPrincessWidgetEntry(defaultView(), {previewed: true});
  assert.match(html, /data-action="desktop"[^>]*>查看<\/button>/);
  assert.doesNotMatch(html, /已添加|已安装|添加成功|安装成功/);
});

test('setup has wide and square choices and uses noninteractive full-poster previews', () => {
  for (const size of ['wide', 'square']) {
    const html = renderPrincessWidgetSetup(defaultView(), {size});
    assert.match(html, new RegExp(`data-widget-size="${size}" aria-pressed="true"`));
    assert.match(html, /cpw-card/);
    assert.match(html, /data-ip="princess"/);
    assert.match(html, new RegExp(`data-size="${size}"`));
    assert.match(html, /根据最近观看更新，不限于《尚公主》/);
    assert.match(html, /未接入真实观看历史/);
    assert.match(html, /data-action="confirm-desktop">预览桌面效果/);
    assert.doesNotMatch(html, /<button[^>]*class="cpw-card|data-action="widget-resume"|widget-v4/);
  }
  const fallback = renderPrincessWidgetSetup(defaultView(), {size: 'huge'});
  assert.match(fallback, /data-widget-size="wide" aria-pressed="true"/);
});

test('desktop preview renders one actual widget click target and an explicit local-only note', () => {
  for (const size of ['wide', 'square']) {
    const html = renderPrincessWidgetSetup(defaultView(), {stage: 'desktop', size});
    assert.equal((html.match(/data-action="widget-resume"/g) || []).length, 1);
    assert.match(html, /<button\b[^>]*data-action="widget-resume"/);
    assert.match(html, /cpw-card/);
    assert.match(html, new RegExp(`data-size="${size}"`));
    assert.match(html, /本地效果预览，未安装系统组件/);
    assert.match(html, /data-action="close">返回日历/);
    assert.doesNotMatch(html, /pc-device|pc-bezel|已安装|添加成功/);
  }
});

test('episode title text and attributes are escaped when a different title is supplied', () => {
  const view = {...defaultView(), title: '<img src=x onerror="oops"> & 剧'};
  const html = renderPrincessWidgetEntry(view) + renderPrincessWidgetSetup(view) + renderPrincessWidgetSetup(view, {stage: 'desktop'});
  assert.match(html, /&lt;img src=x onerror=&quot;oops&quot;&gt; &amp; 剧/);
  assert.doesNotMatch(html, /<img src=x|onerror="oops"/);
});

test('rendering and derivation never mutate the calendar view, history, identity or preview state', () => {
  for (const tier of ['vip', 'svip', 'free']) {
    const session = createPrincessSession({tier});
    const view = selectPrincessCalendar(session);
    const sessionBefore = structuredClone(session), before = structuredClone(view);
    derivePrincessWidgetState(view);
    renderPrincessWidgetEntry(view);
    renderPrincessWidgetEntry(view, {previewed: true});
    for (const size of ['wide', 'square']) for (const stage of ['setup', 'desktop']) renderPrincessWidgetSetup(view, {size, stage});
    assert.deepEqual(view, before);
    assert.deepEqual(session, sessionBefore);
  }
});
