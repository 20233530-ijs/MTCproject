/**
 * MetaMask + 컨트랙트 응답을 모킹하여
 * Admin 역할 연결 후 nav 탭 상태와 모드 전환을 검증한다.
 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    // window.ethereum 주입을 위한 JS
  });
  const page = await ctx.newPage();

  const logs = [];
  page.on('console', function(msg) { logs.push('[' + msg.type() + '] ' + msg.text()); });
  page.on('pageerror', function(err) { logs.push('[ERR] ' + err.message); });

  // ── MetaMask + 컨트랙트 mock 주입 ──────────────────────────────────────────
  await page.addInitScript(function() {
    var MOCK_ACCOUNT = '0xdeadbeef000000000000000000000000deadbeef';

    // eth_accounts / eth_requestAccounts → mock account 반환
    // eth_chainId → Sepolia (0xaa36a7 = 11155111)
    // eth_call → hasRole/hasMillRole/... 모두 true 반환 (bytes32 true)
    window.ethereum = {
      isMetaMask: true,
      request: function(args) {
        if (args.method === 'eth_accounts' || args.method === 'eth_requestAccounts') {
          return Promise.resolve([MOCK_ACCOUNT]);
        }
        if (args.method === 'eth_chainId') {
          return Promise.resolve('0xaa36a7');
        }
        if (args.method === 'eth_call') {
          // hasRole, hasMillRole, hasFabricatorRole, hasIntegratorRole → 모두 true
          // ABI 인코딩된 bool true = 0x0000...0001
          return Promise.resolve(
            '0x0000000000000000000000000000000000000000000000000000000000000001'
          );
        }
        // estimateGas 등 나머지
        return Promise.resolve('0x1');
      },
      on: function() {},
      removeListener: function() {},
      selectedAddress: MOCK_ACCOUNT,
    };
  });

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  // 역할 조회 비동기 완료 대기
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshot_02_admin_connected.png' });
  console.log('[1] Admin 연결 상태 스크린샷 저장');

  // nav 탭 상태 확인
  var navItems = await page.evaluate(function() {
    var items = document.querySelectorAll('header nav a, header nav span');
    return Array.from(items).map(function(el) {
      return {
        tag: el.tagName,
        text: el.textContent.trim().replace(/\s+/g, ' '),
        clickable: el.tagName === 'A',
      };
    });
  });

  console.log('\n[2] Admin 연결 후 네비게이션 탭:');
  var allActive = true;
  navItems.forEach(function(i) {
    var icon = i.clickable ? '✅' : '🚫';
    if (!i.clickable) allActive = false;
    console.log('  ' + icon + ' "' + i.text + '"');
  });
  console.log('\n  → 모든 탭 활성화: ' + (allActive ? '✅ PASS' : '❌ FAIL'));

  // 역할 배지 확인
  var badgeText = await page.evaluate(function() {
    var badge = document.querySelector('[class*="badge-role"]');
    return badge ? badge.textContent.trim() : '(배지 없음)';
  });
  console.log('\n[3] 역할 배지: "' + badgeText + '"');

  // RoleSwitcher 존재 여부
  var hasSwitcher = await page.evaluate(function() {
    // RoleSwitcher는 "모드" 텍스트를 포함한 버튼
    var btns = Array.from(document.querySelectorAll('button'));
    return btns.some(function(b) { return b.textContent.includes('모드'); });
  });
  console.log('[4] RoleSwitcher 표시: ' + (hasSwitcher ? '✅' : '❌'));

  // ── 모드 전환 테스트 ─────────────────────────────────────────────────────────
  if (hasSwitcher) {
    // 드롭다운 열기
    await page.click('button:has-text("모드")');
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'screenshot_03_switcher_open.png' });
    console.log('\n[5] RoleSwitcher 드롭다운 열림 스크린샷 저장');

    // Mill 모드 선택
    var millBtn = await page.$('button:has-text("Mill")');
    if (millBtn) {
      await millBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'screenshot_04_mill_mode.png' });

      var navAfterSwitch = await page.evaluate(function() {
        var items = document.querySelectorAll('header nav a, header nav span');
        return Array.from(items).map(function(el) {
          return { tag: el.tagName, text: el.textContent.trim().replace(/\s+/g, ' '), clickable: el.tagName === 'A' };
        });
      });

      console.log('\n[6] Mill 모드 전환 후 탭 상태:');
      navAfterSwitch.forEach(function(i) {
        console.log('  ' + (i.clickable ? '✅' : '🚫') + ' "' + i.text + '"');
      });

      // 배지 재확인
      var badgeAfter = await page.evaluate(function() {
        var b = document.querySelector('[class*="badge-role"]');
        return b ? b.textContent.trim() : '(없음)';
      });
      console.log('\n[7] Mill 모드 전환 후 배지: "' + badgeAfter + '"');
      var millModeOk = badgeAfter.toLowerCase().includes('mill');
      console.log('  → Mill 모드 유지: ' + (millModeOk ? '✅ PASS' : '❌ FAIL (복귀됨)'));
    } else {
      console.log('[5] Mill 버튼 없음');
    }
  }

  // 에러 요약
  var errors = logs.filter(function(l) { return l.includes('[ERR]') || l.includes('[error]'); });
  if (errors.length) {
    console.log('\n[!] 에러 발생:');
    errors.forEach(function(e) { console.log('  ' + e); });
  } else {
    console.log('\n[8] 에러 없음 ✅');
  }

  await browser.close();
  console.log('\n완료.');
})().catch(function(e) {
  console.error('스크립트 에러:', e.stack);
  process.exit(1);
});
