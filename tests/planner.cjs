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
      localStorage.setItem(SKEY, JSON.stringify(saved));
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
    assert.deepEqual(errors, []);
    console.log('PASS: 10 upstream cost cases, 62 local images, Korean search, save compatibility, new material/farming UI, custom selectors, mobile layout, both HTML entrypoints.');
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
