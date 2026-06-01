const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  const consoleLogs = [];
  page.on('console', function(msg) { consoleLogs.push('[' + msg.type() + '] ' + msg.text()); });
  page.on('pageerror', function(err) { consoleLogs.push('[pageerror] ' + err.message); });

  // ── 1. 홈 (지갑 미연결) ─────────────────────────────────────────────────────
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'screenshot_01_home.png' });
  console.log('[1] 홈 스크린샷 저장 (지갑 미연결)');

  var navItems = await page.evaluate(function() {
    var items = document.querySelectorAll('header nav a, header nav span');
    return Array.from(items).map(function(el) {
      return {
        tag: el.tagName,
        text: el.textContent.trim().replace(/\s+/g, ' '),
        clickable: el.tagName === 'A',
        cursor: window.getComputedStyle(el).cursor,
      };
    });
  });

  console.log('\n[2] 네비게이션 탭 상태 (지갑 미연결):');
  navItems.forEach(function(i) {
    var icon = i.clickable ? '✅ 클릭가능' : '🚫 비활성';
    console.log('  ' + icon + ' "' + i.text + '"');
  });

  // ── 2. 에러 체크 ────────────────────────────────────────────────────────────
  var errors = consoleLogs.filter(function(m) {
    return m.includes('[error]') || m.includes('[pageerror]');
  });
  if (errors.length) {
    console.log('\n[!] 에러 발생:');
    errors.forEach(function(e) { console.log('  ' + e); });
  } else {
    console.log('\n[3] 콘솔 에러 없음 ✅');
  }

  // ── 3. RoleContext 관련 로그 ─────────────────────────────────────────────────
  var roleLogs = consoleLogs.filter(function(m) { return m.includes('Role') || m.includes('role'); });
  if (roleLogs.length) {
    console.log('\n[4] Role 로그:');
    roleLogs.forEach(function(l) { console.log('  ' + l); });
  } else {
    console.log('[4] Role 로그 없음 (지갑 미연결 — 정상)');
  }

  // ── 4. RoleProvider throw 여부 확인 ─────────────────────────────────────────
  var providerErr = consoleLogs.filter(function(m) { return m.includes('RoleProvider'); });
  if (providerErr.length) {
    console.log('\n[!] RoleProvider 에러:', providerErr);
  } else {
    console.log('[5] RoleProvider 정상 마운트 ✅');
  }

  console.log('\n전체 콘솔:');
  consoleLogs.forEach(function(l) { console.log('  ' + l); });

  await browser.close();
  console.log('\n완료.');
})().catch(function(e) {
  console.error('스크립트 에러:', e.message);
  process.exit(1);
});
