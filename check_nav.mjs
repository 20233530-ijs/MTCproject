import { chromium } from 'C:/Users/wltn4/AppData/Roaming/npm/node_modules/playwright/index.js';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
await page.screenshot({ path: 'C:/Users/wltn4/Desktop/MTC_Project/screenshot_01_home.png' });
console.log('[1] 홈페이지 스크린샷 저장');

// nav 항목 수집
const navItems = await page.evaluate(() => {
  const items = document.querySelectorAll('nav a, nav span');
  return Array.from(items).map(el => ({
    tag: el.tagName,
    text: el.textContent.trim(),
    clickable: el.tagName === 'A',
    cursor: window.getComputedStyle(el).cursor,
  }));
});
console.log('\n[2] 지갑 미연결 상태 네비게이션:');
navItems.forEach(i => console.log(`  ${i.clickable ? '✅' : '🚫'} [${i.tag}] "${i.text}" — cursor:${i.cursor}`));

// RoleContext 에러 체크
const errors = [];
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
await page.reload({ waitUntil: 'networkidle' });
if (errors.length) {
  console.log('\n[!] 콘솔 에러:', errors);
} else {
  console.log('\n[3] 콘솔 에러 없음 ✅');
}

// RoleProvider 마운트 확인: RoleContext 에러 여부
const consoleMessages = [];
page.on('console', msg => consoleMessages.push(`[${msg.type()}] ${msg.text()}`));
await page.waitForTimeout(500);

await browser.close();
console.log('\n완료.');
