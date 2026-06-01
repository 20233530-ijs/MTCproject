const playwright = require('C:/Users/wltn4/AppData/Roaming/npm/node_modules/playwright');
const chromium = playwright.chromium;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  // 콘솔 메시지 수집
  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => consoleLogs.push(`[pageerror] ${err.message}`));

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'C:/Users/wltn4/Desktop/MTC_Project/screenshot_01_home.png' });
  console.log('[1] 홈페이지 스크린샷 저장');

  // nav 항목 수집
  const navItems = await page.evaluate(function() {
    var items = document.querySelectorAll('nav a, nav span');
    return Array.from(items).map(function(el) {
      return {
        tag: el.tagName,
        text: el.textContent.trim(),
        clickable: el.tagName === 'A',
        cursor: window.getComputedStyle(el).cursor,
      };
    });
  });

  console.log('\n[2] 지갑 미연결 상태 네비게이션:');
  navItems.forEach(function(i) {
    console.log('  ' + (i.clickable ? '✅' : '🚫') + ' [' + i.tag + '] "' + i.text + '" — cursor:' + i.cursor);
  });

  // 콘솔 에러 출력
  var errors = consoleLogs.filter(function(m) { return m.includes('[error]') || m.includes('[pageerror]'); });
  if (errors.length) {
    console.log('\n[!] 콘솔 에러:');
    errors.forEach(function(e) { console.log('  ' + e); });
  } else {
    console.log('\n[3] 콘솔 에러 없음 ✅');
  }

  // RoleContext 관련 로그 확인
  var roleLogs = consoleLogs.filter(function(m) { return m.includes('Role'); });
  if (roleLogs.length) {
    console.log('\n[4] Role 관련 로그:');
    roleLogs.forEach(function(l) { console.log('  ' + l); });
  }

  await browser.close();
})().catch(function(e) {
  console.error(e.message);
  process.exit(1);
});
