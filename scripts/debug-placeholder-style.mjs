#!/usr/bin/env bun
/**
 * 调试 placeholder 样式
 */
import puppeteer from 'puppeteer-core'

const ext = 'gdjcmpenmogdikhnnaebmddhmdgbfcgl'
const host = 'http://localhost:9222'

async function debug() {
  const browser = await puppeteer.connect({ browserURL: host })
  const page = await browser.newPage()
  
  await page.goto(`chrome-extension://${ext}/management.html`, { waitUntil: 'domcontentloaded' })
  await new Promise(r => setTimeout(r, 1000))
  
  // 点击搜索按钮展开（显示 placeholder）
  const searchBtn = await page.$('.search-icon-button')
  if (searchBtn) {
    await searchBtn.click()
    await new Promise(r => setTimeout(r, 500))
  }
  
  // 获取 placeholder 样式
  const placeholderInfo = await page.evaluate(() => {
    const input = document.querySelector('.search-input input')
    if (!input) return { error: '输入框不存在' }
    
    // 获取 placeholder 伪元素样式
    const placeholderStyle = window.getComputedStyle(input, '::placeholder')
    const inputStyle = window.getComputedStyle(input)
    
    return {
      placeholder: input.placeholder,
      
      '=== Input 样式 ===': '',
      inputFontSize: inputStyle.fontSize,
      inputLineHeight: inputStyle.lineHeight,
      inputHeight: inputStyle.height,
      inputPaddingTop: inputStyle.paddingTop,
      inputPaddingBottom: inputStyle.paddingBottom,
      
      '=== Placeholder 伪元素样式 ===': '',
      placeholderFontSize: placeholderStyle.fontSize,
      placeholderLineHeight: placeholderStyle.lineHeight,
      placeholderColor: placeholderStyle.color,
      placeholderOpacity: placeholderStyle.opacity,
      placeholderTransform: placeholderStyle.transform,
      placeholderVerticalAlign: placeholderStyle.verticalAlign,
      placeholderDisplay: placeholderStyle.display
    }
  })
  
  console.log('\n🔍 Placeholder 样式详情:\n')
  console.log(JSON.stringify(placeholderInfo, null, 2))
  
  await browser.disconnect()
}

debug().catch(console.error)
