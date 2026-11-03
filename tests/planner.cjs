const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const expected = require('./fixtures/v1.6-costs.json');
const names = ['결', '티프로스', '리노', '사', '푸치나'];

(async () => {
  assert.equal(fs.readFileSync(path.join(root, 'index.html'), 'utf8'),
    fs.readFileSync(path.join(root, '엔드필드_육성_플래너.html'), 'utf8'));
  // An OS-selected port avoids interfering with another development server.
  const server = spawn('python3', ['-u', '-m', 'http.server', '0', '--bind', '127.0.0.1'], { cwd: root });
  let browser;
  try {
    const port = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('HTTP server startup timeout')), 10000);
      server.once('error', reject);
      server.once('exit', code => reject(new Error(`HTTP server exited: ${code}`)));
      server.stderr.on('data', () => {});
      server.stdout.on('data', chunk => {
        const match = String(chunk).match(/port (\d+)/);
        if (match) { clearTimeout(timer); resolve(match[1]); }
      });
    });
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
    const context = await browser.newContext();
    // Core functionality and bundled images must work without external CDNs.
    await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1'
      ? route.continue() : route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const base = `http://127.0.0.1:${port}`;
    await page.goto(base, { waitUntil: 'load' });
    assert.equal(await page.evaluate(() => ROSTER.length), 33);

    for (const [id, presets] of Object.entries(expected)) {
      for (const [preset, totals] of Object.entries(presets)) {
        const result = await page.evaluate(({ id, preset }) => {
          const state = blankChar(); state.tgt = presetTarget(preset);
          return needOf(byId[id], state);
        }, { id, preset });
        assert.deepEqual(result, totals, `${id}: ${preset} must match upstream costs`);
      }
    }

    const images = await page.evaluate(async () => {
      const urls = CORE.chars.map(c => c.portrait).concat(
        Object.keys(ITEMS).filter(id => id.startsWith('item_')).map(id => `assets/items/${id}.png`));
      return Promise.all(urls.map(async url => {
        const img = new Image(); img.src = url;
        await img.decode();
        return { url, width: img.naturalWidth };
      }));
    });
    assert.equal(images.length, 62);
    assert(images.every(img => img.width > 0));
    assert.equal(await page.evaluate(() => byId.chr_0002_endminm.portrait), 'assets/operators/endministrator.webp');

    await page.getByRole('button', { name: /^보유만/ }).click();
    assert.equal(await page.locator('.c-open').count(), 1);
    assert.equal(await page.evaluate(() => document.activeElement.dataset.value), 'owned');
    await page.getByRole('button', { name: /^플랜만/ }).click();
    assert.equal(await page.locator('.c-open').count(), 0);
    await page.getByRole('button', { name: '전체 오퍼레이터 보기' }).click();
    assert.equal(await page.locator('.c-open').count(), 33);

    // Hangul composition must not replace the focused search input or move its caret.
    const search = page.getByPlaceholder('이름 검색');
    await search.evaluate(el => { window.testSearchInput = el; });
    await search.dispatchEvent('compositionstart');
    await search.fill('리');
    await page.waitForTimeout(260);
    assert.equal(await page.locator('.c-open').count(), 33);
    await search.fill('리노');
    await search.dispatchEvent('compositionend');
    await search.evaluate(el => el.setSelectionRange(1, 1));
    await page.waitForTimeout(260);
    assert.equal(await page.locator('.c-open').count(), 1);
    assert(await search.evaluate(el => el === window.testSearchInput && el.selectionStart === 1));
    await page.getByRole('button', { name: '검색어 지우기' }).click();
    await page.waitForTimeout(260);
    assert.equal(await page.locator('.c-open').count(), 33);

    await page.getByRole('button', { name: '관리자 상세 열기' }).focus();
    await page.keyboard.press('Enter');
    assert(await page.evaluate(() => document.getElementById('main').inert && getComputedStyle(document.body).overflow === 'hidden'));
    assert(await page.locator('#drawer .d-x').evaluate(el => el === document.activeElement));
    await page.keyboard.press('Shift+Tab');
    assert(await page.evaluate(() => document.getElementById('drawer').contains(document.activeElement)));
    await page.keyboard.press('Tab');
    assert(await page.locator('#drawer .d-x').evaluate(el => el === document.activeElement));
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.openId), 'chr_0002_endminm');
    assert(await page.evaluate(() => !document.getElementById('main').inert && document.getElementById('drawer').inert));

    for (const name of names) {
      await page.getByPlaceholder('이름 검색').fill(name);
      await page.waitForTimeout(260);
      assert(await page.locator('.c-name').filter({ hasText: name }).count() > 0);
    }
    await page.getByPlaceholder('이름 검색').fill('');
    await page.waitForTimeout(260);

    // Seed a pre-update save with one owned operator, inventory, a memo, an image,
    // and a custom operator. New roster entries must be additive.
    const preserved = await page.evaluate(() => {
      const id = 'chr_0002_endminm';
      const old = blankChar(); old.owned = true; old.cur.lv = 17;
      old.memo = '기존 육성 메모'; old.img = CORE.chars[0].portrait;
      const custom = { ...CORE.chars[0], id: 'custom_saved', kr: '나의 오퍼레이터' };
      const saved = { chars: { [id]: old }, inv: { item_gold: 12345 }, custom: [custom],
        ui: { tab: 'ops', fStatus: 'all', fElem: 'all', fRar: 'all', sort: 'default' } };
      clearTimeout(saveT); localStorage.setItem(SKEY, JSON.stringify(saved));
      return old;
    });
    await page.reload({ waitUntil: 'load' });
    assert.deepEqual(await page.evaluate(() => S.chars.chr_0002_endminm), preserved);
    assert.equal(await page.evaluate(() => S.inv.item_gold), 12345);
    assert.equal(await page.evaluate(() => ROSTER.length), 34);
    assert.equal(await page.evaluate(() => S.custom[0].kr), '나의 오퍼레이터');

    await page.evaluate(ids => {
      for (const id of ids) {
        S.chars[id].owned = true; S.chars[id].plan = true;
        S.chars[id].tgt = presetTarget('jong');
      }
      App.saveNow(); App.render();
    }, Object.keys(expected));
    for (const id of Object.keys(expected)) {
      await page.locator(`.card[onclick="App.openDrawer('${id}')"]`).click();
      assert(await page.locator('#drawer.open .ava img').evaluate(img => img.complete && img.naturalWidth > 0));
      await page.keyboard.press('Escape');
    }
    await page.getByRole('button', { name: /재료 정산/ }).click();
    for (const name of ['탈로스 버섯', '붉은 창 잎', '도약 교질 도말 표본']) {
      assert((await page.locator('#main').innerText()).includes(name));
    }
    await page.getByRole('button', { name: /파밍 플랜/ }).click();
    const farm = await page.locator('#main').innerText();
    assert(farm.includes('고위험 재료 용해조') && farm.includes('위험한 재앙 · 사'));
    assert(farm.includes('탈로스 버섯') && farm.includes('붉은 창 잎'));
    const newBoss = page.locator('.fcard').filter({ hasText: '고위험 재료 용해조' });
    assert((await newBoss.innerText()).includes('회당 보상량 확인 중'));
    assert(!(await newBoss.innerText()).includes('확정 9개'));

    await page.evaluate(() => App.editCustom('custom_saved'));
    assert.equal(await page.locator('#cf-e4 option').count(), 6);
    assert.equal(await page.locator('#cf-mush option').count(), 3);
    assert.equal(await page.locator('#cf-gp option').count(), 3);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /오퍼레이터/ }).first().click();
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.reload({ waitUntil: 'load' });
    assert(await page.evaluate(() => S.chars.chr_0036_jsspsi.plan));
    await page.goto(`${base}/${encodeURIComponent('엔드필드_육성_플래너.html')}`, { waitUntil: 'load' });
    assert.equal(await page.evaluate(() => CORE.chars.length), 33);

    // Progress is based on actual growth, including custom goals and zero-work goals.
    const progress = await page.evaluate(() => {
      const c = CORE.chars[0], st = blankChar(); st.owned = true;
      const fresh = growthProgress(c, st).percent;
      st.cur = { lv: 80, br: 4, sk: [9,9,9,9], nd: Object.fromEntries(c.nodes.map(n => [n.k,1])) };
      const jun = growthProgress(c, st).percent;
      st.tgt = presetTarget('jong');
      const junToJong = growthProgress(c, st).percent;
      st.cur.lv = 90; st.cur.sk = [12,12,12,12];
      const jong = growthProgress(c, st).percent;
      delete st.cur.nd[c.nodes[0].k];
      const missingNode = growthProgress(c, st).percent;
      st.cur = blankChar().cur;
      st.tgt = { preset: 'custom', lv: 1, br: 0, sk: [1,1,1,1], nd: {} };
      const zeroWork = growthProgress(c, st).percent;
      st.tgt.nd[c.nodes[0].k] = 1;
      const nodeOnly = growthProgress(c, st).percent;
      st.cur.nd[c.nodes[0].k] = 1;
      const nodeComplete = growthProgress(c, st).percent;
      st.owned = false;
      const unowned = growthProgress(c, st).percent;
      return { fresh, jun, junToJong, jong, missingNode, zeroWork, nodeOnly, nodeComplete, unowned };
    });
    assert.equal(progress.fresh, 0);
    assert.equal(progress.jun, 100);
    assert.equal(progress.junToJong, 90);
    assert.equal(progress.jong, 100);
    assert(progress.missingNode < 100);
    assert.equal(progress.zeroWork, 100);
    assert.equal(progress.nodeOnly, 0);
    assert.equal(progress.nodeComplete, 100);
    assert.equal(progress.unowned, null);

    await page.evaluate(() => { clearTimeout(saveT); localStorage.removeItem(SKEY); });
    await page.reload({ waitUntil: 'load' });
    const before = await page.evaluate(() => {
      const st = S.chars.chr_0002_endminm;
      st.tgt = presetTarget('jong'); st.plan = true; st.memo = '유지할 메모';
      st.img = byId.chr_0002_endminm.portrait; S.inv.item_gold = 45678;
      App.render();
      return JSON.parse(JSON.stringify({ cur: st.cur, tgt: st.tgt, plan: st.plan, memo: st.memo, img: st.img }));
    });
    await page.getByRole('button', { name: '관리자 현재를 준종결로 적용', exact: true }).click();
    assert.equal(await page.getByRole('progressbar', { name: '관리자 목표 육성 진행률', exact: true }).getAttribute('aria-valuenow'), '90');
    const applied = await page.evaluate(() => {
      const st = S.chars.chr_0002_endminm;
      return { cur: st.cur, tgt: st.tgt, plan: st.plan, memo: st.memo, img: st.img, owned: st.owned, gold: S.inv.item_gold };
    });
    assert.equal(applied.cur.lv, 80);
    assert.equal(applied.cur.br, 4);
    assert.deepEqual(applied.cur.sk, [9,9,9,9]);
    assert.equal(applied.owned, true);
    for (const key of ['tgt','plan','memo','img']) assert.deepEqual(applied[key], before[key]);
    assert.equal(applied.gold, 45678);
    await page.locator('#toast').getByRole('button', { name: '되돌리기' }).click();
    assert.deepEqual(await page.evaluate(() => S.chars.chr_0002_endminm.cur), before.cur);
    await page.getByRole('button', { name: '관리자 현재를 종결로 적용', exact: true }).click();
    assert.equal(await page.getByRole('progressbar', { name: '관리자 목표 육성 진행률', exact: true }).getAttribute('aria-valuenow'), '100');
    assert.deepEqual(await page.evaluate(() => needOf(byId.chr_0002_endminm, S.chars.chr_0002_endminm)), {});
    await page.getByRole('combobox', { name: '관리자 성장 목표', exact: true }).selectOption('jun');
    assert.equal(await page.getByRole('progressbar', { name: '관리자 목표 육성 진행률', exact: true }).getAttribute('aria-valuenow'), '100');
    await page.waitForTimeout(300);
    await page.reload({ waitUntil: 'load' });
    assert.equal(await page.evaluate(() => S.chars.chr_0002_endminm.cur.lv), 90);
    assert.equal(await page.evaluate(() => App.canUndoCurrent('chr_0002_endminm')), false);
    await page.getByRole('button', { name: '관리자 상세 열기', exact: true }).click();
    await page.getByRole('button', { name: '준종결로 적용', exact: true }).click();
    assert.equal(await page.evaluate(() => S.chars.chr_0002_endminm.cur.lv), 80);
    await page.locator('#drawer').getByRole('button', { name: '되돌리기', exact: true }).click();
    assert.equal(await page.evaluate(() => S.chars.chr_0002_endminm.cur.lv), 90);
    await page.getByRole('button', { name: '준종결로 적용', exact: true }).click();
    await page.evaluate(() => { S.chars.chr_0002_endminm.cur.lv = 79; App.undoCurrentPreset('chr_0002_endminm'); });
    assert.equal(await page.evaluate(() => S.chars.chr_0002_endminm.cur.lv), 79);
    const customTarget = await page.evaluate(() => {
      const st = S.chars.chr_0002_endminm;
      st.tgt = { preset: 'custom', lv: 80, br: 4, sk: [9,9,9,9], nd: { equipBreakT2: 1 } };
      const before = JSON.stringify(st.tgt);
      App.setPreset('custom');
      return { before, after: JSON.stringify(st.tgt) };
    });
    assert.equal(customTarget.after, customTarget.before);
    await page.keyboard.press('Escape');

    await page.evaluate(() => {
      App.applyCurrentPreset('chr_0002_endminm', 'jong');
      const backup = JSON.stringify(S);
      App.go('data'); document.getElementById('io').value = backup;
      App.pasteData();
    });
    assert.equal(await page.evaluate(() => App.canUndoCurrent('chr_0002_endminm')), false);
    await page.getByRole('button', { name: /오퍼레이터/ }).first().click();

    // The switch persists independently of saves/imported planner state.
    const initialTheme = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.locator('#theme-toggle').click();
    const chosenTheme = initialTheme === 'dark' ? 'light' : 'dark';
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), chosenTheme);
    await page.reload({ waitUntil: 'load' });
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), chosenTheme);
    await page.locator('#theme-toggle').click();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), initialTheme);
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    assert.deepEqual(errors, []);
    console.log('PASS: upstream costs, 62 images, shared portrait, IME/search/filters, modal keyboard navigation, save compatibility, 9 progress cases, quick presets and safe undo, theme persistence, 320/390/1440px layouts, both entrypoints.');
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
