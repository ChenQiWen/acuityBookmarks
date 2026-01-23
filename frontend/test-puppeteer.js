/**
 * 测试 Puppeteer 是否正常工作
 *
 * 运行方式：
 * node test-puppeteer.js
 */

import puppeteer from 'puppeteer'

;(async () => {
  console.log('🚀 测试 Puppeteer 安装...\n')

  try {
    console.log('⏳ 启动浏览器...')
    const startTime = Date.now()

    const browser = await puppeteer.launch({
      headless: false,
      timeout: 180000 // 3 分钟超时（首次运行可能需要下载 Chromium）
    })

    const launchTime = Date.now() - startTime
    console.log(
      `✅ 浏览器启动成功！耗时: ${launchTime}ms (${(launchTime / 1000).toFixed(1)}秒)\n`
    )

    console.log('⏳ 创建测试页面...')
    const page = await browser.newPage()
    console.log('✅ 页面创建成功\n')

    console.log('⏳ 访问测试网站...')
    await page.goto('https://example.com')
    const title = await page.title()
    console.log(`✅ 页面标题: ${title}\n`)

    console.log('⏳ 关闭浏览器...')
    await browser.close()
    console.log('✅ 浏览器已关闭\n')

    console.log('🎉 Puppeteer 工作正常！\n')
    console.log('📝 下一步：运行 E2E 测试')
    console.log('   bun run test:service-worker:e2e\n')
  } catch (error) {
    console.error('❌ Puppeteer 测试失败:\n')
    console.error(error.message)
    console.error('\n💡 可能的原因:')
    console.error('   1. Chromium 正在下载中（首次运行需要下载 ~300MB）')
    console.error('   2. 系统资源不足')
    console.error('   3. 网络连接问题\n')
    console.error('💡 解决方案:')
    console.error('   1. 等待 Chromium 下载完成后重试')
    console.error('   2. 检查网络连接')
    console.error('   3. 重启终端后重试\n')
    process.exit(1)
  }
})()
