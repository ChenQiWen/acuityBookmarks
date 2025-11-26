#!/usr/bin/env bun
/**
 * 实时调试搜索输入框样式
 */
import puppeteer from 'puppeteer-core'

const ext = 'gdjcmpenmogdikhnnaebmddhmdgbfcgl'
const host = 'http://localhost:9222'

async function debug() {
  const browser = await puppeteer.connect({ browserURL: host })
  const page = await browser.newPage()
  
  await page.goto(`chrome-extension://${ext}/management.html`, { waitUntil: 'domcontentloaded' })
  await new Promise(r => setTimeout(r, 1000))
  
  // 点击搜索按钮展开
  const searchBtn = await page.$('.search-icon-button')
  if (searchBtn) {
    await searchBtn.click()
    await new Promise(r => setTimeout(r, 500))
  }
  
  // 输入文本
  const input = await page.$('.search-input input')
  if (input) {
    await input.type('测试文本123', { delay: 50 })
    await new Promise(r => setTimeout(r, 500))
  }
  
  // 获取详细的样式信息
  const styleInfo = await page.evaluate(() => {
    const container = document.querySelector('.search-input .acuity-input-container')
    const input = document.querySelector('.search-input input')
    
    if (!container || !input) return { error: '元素不存在' }
    
    const containerStyle = window.getComputedStyle(container)
    const inputStyle = window.getComputedStyle(input)
    const containerRect = container.getBoundingClientRect()
    const inputRect = input.getBoundingClientRect()
    
    // 创建一个临时的测量元素来获取文本实际高度
    const tempSpan = document.createElement('span')
    tempSpan.style.cssText = `
      font-family: ${inputStyle.fontFamily};
      font-size: ${inputStyle.fontSize};
      line-height: ${inputStyle.lineHeight};
      position: absolute;
      visibility: hidden;
      white-space: nowrap;
    `
    tempSpan.textContent = input.value || 'Ay'
    document.body.appendChild(tempSpan)
    const textRect = tempSpan.getBoundingClientRect()
    document.body.removeChild(tempSpan)
    
    return {
      '=== 容器信息 ===': '',
      containerHeight: containerRect.height,
      containerMinHeight: containerStyle.minHeight,
      containerDisplay: containerStyle.display,
      containerAlignItems: containerStyle.alignItems,
      containerPadding: {
        top: containerStyle.paddingTop,
        bottom: containerStyle.paddingBottom,
        left: containerStyle.paddingLeft,
        right: containerStyle.paddingRight
      },
      
      '=== 输入框信息 ===': '',
      inputWidth: inputRect.width,
      inputHeight: inputRect.height,
      inputComputedHeight: inputStyle.height,
      inputBox: {
        top: inputRect.top,
        bottom: inputRect.bottom,
        left: inputRect.left,
        right: inputRect.right
      },
      
      '=== 文本样式 ===': '',
      fontSize: inputStyle.fontSize,
      lineHeight: inputStyle.lineHeight,
      fontFamily: inputStyle.fontFamily,
      textAlign: inputStyle.textAlign,
      verticalAlign: inputStyle.verticalAlign,
      
      '=== Padding & Margin ===': '',
      inputPadding: {
        top: inputStyle.paddingTop,
        bottom: inputStyle.paddingBottom,
        left: inputStyle.paddingLeft,
        right: inputStyle.paddingRight
      },
      inputMargin: {
        top: inputStyle.marginTop,
        bottom: inputStyle.marginBottom
      },
      
      '=== 实际文本测量 ===': '',
      actualTextHeight: textRect.height,
      textContent: input.value,
      
      '=== 位置计算 ===': '',
      containerCenter: containerRect.top + containerRect.height / 2,
      inputCenter: inputRect.top + inputRect.height / 2,
      verticalOffset: Math.abs((containerRect.top + containerRect.height / 2) - (inputRect.top + inputRect.height / 2)),
      
      '=== 其他属性 ===': '',
      boxSizing: inputStyle.boxSizing,
      border: inputStyle.border,
      outline: inputStyle.outline
    }
  })
  
  console.log('\n🔍 搜索输入框样式详情:\n')
  console.log(JSON.stringify(styleInfo, null, 2))
  
  await browser.disconnect()
}

debug().catch(console.error)
