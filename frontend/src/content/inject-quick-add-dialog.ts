/**
 * 注入快速添加书签对话框到当前页面
 *
 * 使用覆盖层方式，模拟 Chrome 原生对话框样式
 *
 * ⚠️ 注意：Content Script 运行在页面环境，不能使用 @/ 别名导入
 * 只能使用相对路径或直接使用 Chrome API
 */

const loggerPrefix = 'ContentScript:QuickAdd'

// 简化的日志函数（content script 环境）
function log(
  level: 'info' | 'warn' | 'error',
  message: string,
  ...args: unknown[]
): void {
  if (typeof console !== 'undefined' && console[level]) {
    console[level](`[${loggerPrefix}]`, message, ...args)
  }
}

/**
 * 创建 Chrome 原生样式的对话框
 */
function createNativeStyleDialog(data: {
  title: string
  url: string
  favIconUrl?: string
}): void {
  // 检查是否已经存在对话框，避免重复创建
  if (document.getElementById('acuity-quick-add-dialog')) {
    log('warn', '对话框已存在，跳过创建')
    return
  }

  // 创建遮罩层
  const overlay = document.createElement('div')
  overlay.id = 'acuity-quick-add-overlay'
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.3);
    z-index: 2147483647;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  `

  // 创建对话框容器
  const dialog = document.createElement('div')
  dialog.id = 'acuity-quick-add-dialog'
  dialog.style.cssText = `
    background: #ffffff;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    width: 480px;
    max-width: 90vw;
    padding: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  `

  // 标题栏（完全复刻 Chrome 原生样式）
  const titleBar = document.createElement('div')
  titleBar.style.cssText = `
    padding: 14px 16px;
    border-bottom: 1px solid #e8eaed;
    font-size: 13px;
    font-weight: 500;
    color: #202124;
    background: #ffffff;
    line-height: 1.5;
    letter-spacing: 0.2px;
  `
  titleBar.textContent = '添加书签'

  // 内容区域（完全复刻 Chrome 原生样式）
  const content = document.createElement('div')
  content.style.cssText = `
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: #ffffff;
  `

  // 名称输入框（Chrome 原生样式）
  const nameLabel = document.createElement('label')
  nameLabel.style.cssText = `
    display: block;
    font-size: 13px;
    font-weight: 400;
    color: #5f6368;
    margin-bottom: 6px;
  `
  nameLabel.textContent = '名称'

  const nameInput = document.createElement('input')
  nameInput.type = 'text'
  nameInput.value = data.title
  nameInput.placeholder = '书签名称'
  nameInput.style.cssText = `
    width: 100%;
    padding: 6px 8px;
    border: 1px solid #dadce0;
    border-radius: 2px;
    font-size: 13px;
    color: #202124;
    background: #ffffff;
    outline: none;
    box-sizing: border-box;
    font-family: inherit;
    transition: border-color 0.1s ease, box-shadow 0.1s ease;
  `
  nameInput.addEventListener('focus', () => {
    // Chrome 原生：绿色焦点边框（完全复刻）
    nameInput.style.borderColor = '#34a853'
    nameInput.style.boxShadow = 'inset 0 0 0 1px #34a853'
  })
  nameInput.addEventListener('blur', () => {
    nameInput.style.borderColor = '#dadce0'
    nameInput.style.boxShadow = 'none'
  })
  nameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault()
      urlInput.focus()
    }
    if (e.key === 'Escape') {
      handleClose()
    }
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      urlInput.focus()
    }
  })

  // URL 输入框（Chrome 原生样式）
  const urlLabel = document.createElement('label')
  urlLabel.style.cssText = `
    display: block;
    font-size: 13px;
    font-weight: 400;
    color: #5f6368;
    margin-bottom: 6px;
  `
  urlLabel.textContent = 'URL'

  const urlInput = document.createElement('input')
  urlInput.type = 'text'
  urlInput.value = data.url
  urlInput.placeholder = '网址'
  urlInput.style.cssText = `
    width: 100%;
    padding: 6px 8px;
    border: 1px solid #dadce0;
    border-radius: 2px;
    font-size: 13px;
    color: #202124;
    background: #ffffff;
    outline: none;
    box-sizing: border-box;
    font-family: inherit;
    transition: border-color 0.1s ease, box-shadow 0.1s ease;
  `
  urlInput.addEventListener('focus', () => {
    // Chrome 原生：绿色焦点边框（完全复刻）
    urlInput.style.borderColor = '#34a853'
    urlInput.style.boxShadow = 'inset 0 0 0 1px #34a853'
  })
  urlInput.addEventListener('blur', () => {
    urlInput.style.borderColor = '#dadce0'
    urlInput.style.boxShadow = 'none'
    // 失焦时检查重复
    const url = urlInput.value.trim()
    if (url) {
      checkDuplicate(url)
    }
  })
  urlInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleConfirm()
    }
    if (e.key === 'Escape') {
      handleClose()
    }
  })

  // 文件夹选择（树形结构，Chrome 原生样式）
  const folderLabel = document.createElement('label')
  folderLabel.style.cssText = `
    display: block;
    font-size: 13px;
    font-weight: 400;
    color: #5f6368;
    margin-bottom: 6px;
  `
  folderLabel.textContent = '文件夹'

  // 创建树形容器（完全复刻 Chrome 原生样式）
  const folderTreeContainer = document.createElement('div')
  folderTreeContainer.id = 'acuity-folder-tree'
  folderTreeContainer.style.cssText = `
    width: 100%;
    max-height: 250px;
    min-height: 120px;
    border: 1px solid #dadce0;
    border-radius: 2px;
    background: #ffffff;
    overflow-y: auto;
    overflow-x: hidden;
    box-sizing: border-box;
    font-size: 13px;
    padding: 2px 0;
  `

  // Chrome 原生滚动条样式
  if (!document.getElementById('acuity-scrollbar-styles')) {
    const styleSheet = document.createElement('style')
    styleSheet.id = 'acuity-scrollbar-styles'
    styleSheet.textContent = `
      #acuity-folder-tree::-webkit-scrollbar,
      [id^="acuity-duplicate-warning"]::-webkit-scrollbar {
        width: 16px;
      }
      #acuity-folder-tree::-webkit-scrollbar-track,
      [id^="acuity-duplicate-warning"]::-webkit-scrollbar-track {
        background: transparent;
      }
      #acuity-folder-tree::-webkit-scrollbar-thumb,
      [id^="acuity-duplicate-warning"]::-webkit-scrollbar-thumb {
        background: #dadce0;
        border-radius: 8px;
        border: 4px solid transparent;
        background-clip: padding-box;
      }
      #acuity-folder-tree::-webkit-scrollbar-thumb:hover,
      [id^="acuity-duplicate-warning"]::-webkit-scrollbar-thumb:hover {
        background: #bdc1c6;
        background-clip: padding-box;
      }
    `
    document.head.appendChild(styleSheet)
  }

  // 当前选中的文件夹 ID
  let selectedFolderId = ''

  // 创建树形选择器
  log('info', '🎯 创建树形选择器...')
  const { updateTree, getSelectedFolderId, setSelectedFolderId } =
    createFolderTreeSelector(folderTreeContainer, (folderId: string) => {
      selectedFolderId = folderId
      log('info', '文件夹已选中', folderId)
    })
  log('info', '✅ 树形选择器创建完成')

  // 加载文件夹树（立即调用，不等待）
  log('info', '🚀 开始加载文件夹树...')
  loadFolderTree(updateTree)
    .then(() => {
      log('info', '✅ 文件夹树加载完成，尝试选择默认文件夹')
      // 等待 DOM 更新后再查找书签栏
      setTimeout(() => {
        const bookmarksBarId = findBookmarksBarId(folderTreeContainer)
        if (bookmarksBarId) {
          setSelectedFolderId(bookmarksBarId)
          selectedFolderId = bookmarksBarId
          log('info', '✅ 已选择默认书签栏', { bookmarksBarId })
        } else {
          log('warn', '未找到书签栏，使用第一个可用文件夹')
          // 如果找不到书签栏，选择第一个文件夹
          const firstFolder =
            folderTreeContainer.querySelector('[data-folder-id]')
          if (firstFolder) {
            const firstFolderId = firstFolder.getAttribute('data-folder-id')
            if (firstFolderId) {
              setSelectedFolderId(firstFolderId)
              selectedFolderId = firstFolderId
              log('info', '✅ 已选择第一个文件夹', { firstFolderId })
            }
          } else {
            log('error', '❌ 树形容器中没有任何文件夹！', {
              containerId: folderTreeContainer.id,
              hasChildren: folderTreeContainer.children.length,
              innerHTML: folderTreeContainer.innerHTML.substring(0, 200)
            })
          }
        }
      }, 100)
    })
    .catch(error => {
      log('error', '❌ 加载文件夹树失败', error)
      console.error('加载文件夹树失败:', error)
    })

  // AI 建议区域（如果启用）
  const aiSuggestionDiv = document.createElement('div')
  aiSuggestionDiv.style.cssText = `
    display: none;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: #e8f0fe;
    border-left: 3px solid #1a73e8;
    border-radius: 4px;
    font-size: 13px;
    color: #5f6368;
  `

  const aiIcon = document.createElement('span')
  aiIcon.textContent = '✨'
  aiIcon.style.marginRight = '4px'

  const aiText = document.createElement('span')
  aiText.textContent = 'AI 建议：'

  const aiButton = document.createElement('button')
  aiButton.style.cssText = `
    background: none;
    border: none;
    color: #1a73e8;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
  `
  aiButton.addEventListener('click', () => {
    const folderId = aiButton.dataset.folderId || ''
    if (folderId) {
      setSelectedFolderId(folderId)
      selectedFolderId = folderId
      // 滚动到选中项
      const selectedItem = folderTreeContainer.querySelector(
        `[data-folder-id="${folderId}"]`
      ) as HTMLElement
      if (selectedItem) {
        selectedItem.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  })

  aiSuggestionDiv.appendChild(aiIcon)
  aiSuggestionDiv.appendChild(aiText)
  aiSuggestionDiv.appendChild(aiButton)

  // 获取 AI 建议（异步）
  getAISuggestion(data.title, data.url).then(suggestion => {
    if (suggestion) {
      aiButton.textContent = suggestion.folderName
      aiButton.dataset.folderId = suggestion.folderId
      aiSuggestionDiv.style.display = 'flex'
      if (!selectedFolderId) {
        setSelectedFolderId(suggestion.folderId)
        selectedFolderId = suggestion.folderId
      }
    }
  })

  // 组装内容（Chrome 原生布局）
  const nameGroup = document.createElement('div')
  nameGroup.style.cssText = 'display: flex; flex-direction: column;'
  nameGroup.appendChild(nameLabel)
  nameGroup.appendChild(nameInput)

  const urlGroup = document.createElement('div')
  urlGroup.style.cssText = 'display: flex; flex-direction: column;'
  urlGroup.appendChild(urlLabel)
  urlGroup.appendChild(urlInput)

  const folderGroup = document.createElement('div')
  folderGroup.style.cssText = 'display: flex; flex-direction: column;'
  folderGroup.appendChild(folderLabel)
  folderGroup.appendChild(folderTreeContainer)

  content.appendChild(nameGroup)
  content.appendChild(urlGroup)
  content.appendChild(folderGroup)
  content.appendChild(aiSuggestionDiv)

  // 按钮栏（Chrome 原生样式：Cancel 和 Save 在右侧）
  const buttonBar = document.createElement('div')
  buttonBar.style.cssText = `
    padding: 12px 16px;
    border-top: 1px solid #e8eaed;
    background: #ffffff;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 8px;
  `

  // Cancel 按钮（完全复刻 Chrome 原生样式：浅青色背景）
  const cancelButton = document.createElement('button')
  cancelButton.textContent = '取消'
  cancelButton.style.cssText = `
    padding: 6px 12px;
    border: none;
    border-radius: 2px;
    background: #e8f0fe;
    color: #1a73e8;
    font-size: 13px;
    font-weight: 400;
    cursor: pointer;
    outline: none;
    font-family: inherit;
    min-width: 54px;
    transition: background-color 0.1s ease;
  `
  cancelButton.addEventListener('click', handleClose)
  cancelButton.addEventListener('mouseenter', () => {
    cancelButton.style.backgroundColor = '#d2e3fc'
  })
  cancelButton.addEventListener('mouseleave', () => {
    cancelButton.style.backgroundColor = '#e8f0fe'
  })
  cancelButton.addEventListener('mousedown', () => {
    cancelButton.style.backgroundColor = '#bad5fc'
  })
  cancelButton.addEventListener('mouseup', () => {
    cancelButton.style.backgroundColor = '#e8f0fe'
  })

  // Save 按钮（完全复刻 Chrome 原生样式：深绿色背景）
  const saveButton = document.createElement('button')
  saveButton.textContent = '保存'
  saveButton.style.cssText = `
    padding: 6px 12px;
    border: none;
    border-radius: 2px;
    background: #137333;
    color: #ffffff;
    font-size: 13px;
    font-weight: 400;
    cursor: pointer;
    outline: none;
    font-family: inherit;
    min-width: 54px;
    transition: background-color 0.1s ease;
  `
  saveButton.addEventListener('click', handleConfirm)
  saveButton.addEventListener('mouseenter', () => {
    saveButton.style.backgroundColor = '#0f5c26'
  })
  saveButton.addEventListener('mouseleave', () => {
    saveButton.style.backgroundColor = '#137333'
  })
  saveButton.addEventListener('mousedown', () => {
    saveButton.style.backgroundColor = '#0a4019'
  })
  saveButton.addEventListener('mouseup', () => {
    saveButton.style.backgroundColor = '#137333'
  })

  buttonBar.appendChild(cancelButton)
  buttonBar.appendChild(saveButton)

  // 组装对话框
  dialog.appendChild(titleBar)
  dialog.appendChild(content)
  dialog.appendChild(buttonBar)

  overlay.appendChild(dialog)
  document.body.appendChild(overlay)

  // 聚焦输入框
  setTimeout(() => {
    nameInput.focus()
    nameInput.select()
    // 对话框打开时立即检查重复（因为 URL 已有初始值）
    if (data.url && data.url.trim()) {
      checkDuplicate(data.url, data.title)
    }
  }, 100)

  // 关闭对话框
  function handleClose(): void {
    overlay.remove()
  }

  // ✅ 扩展功能 1：收藏开关
  const favoriteCheckbox = document.createElement('input')
  favoriteCheckbox.type = 'checkbox'
  favoriteCheckbox.id = 'acuity-favorite-checkbox'
  favoriteCheckbox.style.cssText = `
    margin-right: 6px;
    cursor: pointer;
  `

  const favoriteLabel = document.createElement('label')
  favoriteLabel.setAttribute('for', 'acuity-favorite-checkbox')
  favoriteLabel.style.cssText = `
    display: flex;
    align-items: center;
    font-size: 13px;
    color: #5f6368;
    cursor: pointer;
    user-select: none;
  `
  favoriteLabel.appendChild(favoriteCheckbox)
  favoriteLabel.appendChild(document.createTextNode('⭐ 添加到收藏'))

  const favoriteGroup = document.createElement('div')
  favoriteGroup.style.cssText = `
    display: flex;
    align-items: center;
    margin-top: 4px;
  `
  favoriteGroup.appendChild(favoriteLabel)

  // ✅ 扩展功能 2：去重检测提示（URL 和名称）
  let duplicateWarningDiv: HTMLElement | null = null

  async function checkDuplicate(url: string, title?: string): Promise<void> {
    if (!url || url.trim() === '') {
      return
    }

    try {
      const currentTitle = title || nameInput.value.trim() || ''

      const response = await new Promise<{
        success?: boolean
        urlDuplicate?: boolean
        titleDuplicate?: boolean
        existingBookmarks?: Array<{
          title: string
          url?: string
          folderPath?: string
          type: 'url' | 'title'
        }>
      }>((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            type: 'CHECK_DUPLICATE_BOOKMARK',
            data: {
              url: url.trim(),
              title: currentTitle
            }
          },
          response => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message))
            } else {
              resolve(response || {})
            }
          }
        )
      })

      if (
        response.success &&
        response.existingBookmarks &&
        response.existingBookmarks.length > 0
      ) {
        // 显示重复警告
        if (duplicateWarningDiv) {
          duplicateWarningDiv.remove()
        }

        duplicateWarningDiv = document.createElement('div')
        duplicateWarningDiv.id = 'acuity-duplicate-warning'
        duplicateWarningDiv.style.cssText = `
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 12px;
          background: #fef3e2;
          border: 1px solid #fbbc04;
          border-radius: 4px;
          font-size: 12px;
          color: #5f6368;
          margin-top: 8px;
          max-height: 200px;
          overflow-y: auto;
          overflow-x: hidden;
        `

        const warningHeader = document.createElement('div')
        warningHeader.style.cssText = `
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 500;
          color: #f57c00;
        `
        const warningIcon = document.createElement('span')
        warningIcon.textContent = '⚠️'
        warningIcon.style.cssText = 'flex-shrink: 0; font-size: 14px;'
        const warningTitle = document.createElement('span')
        warningTitle.textContent = '检测到重复书签'
        warningHeader.appendChild(warningIcon)
        warningHeader.appendChild(warningTitle)

        const warningContent = document.createElement('div')
        warningContent.style.cssText = `
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding-left: 20px;
          font-size: 11px;
          line-height: 1.4;
          overflow-y: auto;
          overflow-x: hidden;
        `

        response.existingBookmarks.forEach(bookmark => {
          const item = document.createElement('div')
          item.style.cssText =
            'display: flex; flex-direction: column; gap: 2px;'

          const typeLabel = document.createElement('span')
          typeLabel.style.cssText = 'font-weight: 500; color: #f57c00;'
          typeLabel.textContent =
            bookmark.type === 'url' ? '📍 URL 重复：' : '📝 名称重复：'

          const titleText = document.createElement('span')
          titleText.textContent = `"${bookmark.title}"`
          titleText.style.cssText = 'color: #202124;'

          const pathText = document.createElement('span')
          const folderPath = bookmark.folderPath || '未知位置'
          pathText.textContent = `位于: ${folderPath}`
          pathText.style.cssText = 'color: #5f6368; font-size: 10px;'

          if (bookmark.url) {
            const urlText = document.createElement('span')
            urlText.textContent = bookmark.url
            urlText.style.cssText =
              'color: #5f6368; font-size: 10px; word-break: break-all;'
            item.appendChild(urlText)
          }

          item.appendChild(typeLabel)
          item.appendChild(titleText)
          item.appendChild(pathText)
          warningContent.appendChild(item)
        })

        duplicateWarningDiv.appendChild(warningHeader)
        duplicateWarningDiv.appendChild(warningContent)

        // 插入到 URL 输入框下方
        urlGroup.appendChild(duplicateWarningDiv)
        log('warn', '检测到重复书签', response.existingBookmarks)
      } else if (duplicateWarningDiv) {
        duplicateWarningDiv.remove()
        duplicateWarningDiv = null
      }
    } catch (error) {
      log('error', '检查重复书签失败', error)
    }
  }

  // 监听名称输入变化，检查名称重复
  nameInput.addEventListener('blur', () => {
    const title = nameInput.value.trim()
    const url = urlInput.value.trim()
    if (title && url) {
      checkDuplicate(url, title)
    }
  })

  // 监听 URL 输入变化（实时检查）
  urlInput.addEventListener('input', () => {
    // 如果之前有警告，先清除
    if (duplicateWarningDiv) {
      duplicateWarningDiv.remove()
      duplicateWarningDiv = null
    }
  })

  // ✅ 扩展功能 3：智能名称优化
  function optimizeTitle(title: string): string {
    // 移除常见的冗余后缀
    const patterns = [
      / - Google\s*搜索$/i,
      / - Google\s*Search$/i,
      / \|.*$/,
      / \-\-.*$/,
      /\s*-\s*首页$/,
      /\s*-\s*Homepage$/i
    ]

    let optimized = title
    for (const pattern of patterns) {
      optimized = optimized.replace(pattern, '')
    }

    // 如果标题过长，智能截断（保留关键词）
    if (optimized.length > 60) {
      // 尝试在空格处截断
      const truncated = optimized.substring(0, 57) + '...'
      return truncated
    }

    return optimized.trim() || title
  }

  // 监听名称输入框，提供优化建议
  let optimizedTitleDiv: HTMLElement | null = null

  nameInput.addEventListener('blur', () => {
    const currentTitle = nameInput.value.trim()
    if (!currentTitle) {
      return
    }

    const optimized = optimizeTitle(currentTitle)
    if (optimized !== currentTitle && optimized.length > 0) {
      // 显示优化建议
      if (optimizedTitleDiv) {
        optimizedTitleDiv.remove()
      }

      optimizedTitleDiv = document.createElement('div')
      optimizedTitleDiv.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        background: #e8f5e9;
        border-left: 3px solid #34a853;
        border-radius: 4px;
        font-size: 12px;
        color: #5f6368;
        margin-top: 4px;
      `

      const suggestionIcon = document.createElement('span')
      suggestionIcon.textContent = '💡'
      suggestionIcon.style.cssText = 'flex-shrink: 0;'

      const suggestionText = document.createElement('span')
      suggestionText.style.cssText = 'flex: 1;'
      suggestionText.textContent = `建议名称: "${optimized}"`

      const useButton = document.createElement('button')
      useButton.textContent = '使用'
      useButton.style.cssText = `
        background: #34a853;
        color: #ffffff;
        border: none;
        border-radius: 2px;
        padding: 4px 8px;
        font-size: 11px;
        cursor: pointer;
        flex-shrink: 0;
      `
      useButton.addEventListener('click', () => {
        nameInput.value = optimized
        if (optimizedTitleDiv) {
          optimizedTitleDiv.remove()
          optimizedTitleDiv = null
        }
        nameInput.focus()
      })

      optimizedTitleDiv.appendChild(suggestionIcon)
      optimizedTitleDiv.appendChild(suggestionText)
      optimizedTitleDiv.appendChild(useButton)

      nameGroup.appendChild(optimizedTitleDiv)
    }
  })

  // 将收藏开关添加到 URL 输入框下方
  urlGroup.appendChild(favoriteGroup)

  // 确认保存
  async function handleConfirm(): Promise<void> {
    const title = nameInput.value.trim()
    const url = urlInput.value.trim()
    const folderId = selectedFolderId || getSelectedFolderId()
    const isFavorite = favoriteCheckbox.checked

    if (!title) {
      showNotification('请输入书签名称', 'warning')
      nameInput.focus()
      return
    }

    if (!url) {
      showNotification('请输入 URL', 'warning')
      urlInput.focus()
      return
    }

    if (!folderId) {
      showNotification('请选择文件夹', 'warning')
      return
    }

    // ✅ 扩展功能：如果检测到重复，提示用户确认
    if (duplicateWarningDiv) {
      const confirmed = confirm(
        '检测到此 URL 已存在，是否仍要添加？\n\n点击"确定"继续添加，点击"取消"放弃。'
      )
      if (!confirmed) {
        return
      }
    }

    // 禁用保存按钮，显示加载状态
    saveButton.disabled = true
    saveButton.textContent = '保存中...'
    saveButton.style.opacity = '0.6'
    saveButton.style.cursor = 'not-allowed'

    log('info', '📤 发送创建书签请求', { title, url, folderId, isFavorite })

    // 发送消息到 background 创建书签
    chrome.runtime.sendMessage(
      {
        type: 'CREATE_BOOKMARK',
        data: {
          title,
          url,
          parentId: folderId,
          isFavorite // ✅ 扩展功能：传递收藏状态
        }
      },
      async response => {
        // 恢复保存按钮
        saveButton.disabled = false
        saveButton.textContent = '保存'
        saveButton.style.opacity = '1'
        saveButton.style.cursor = 'pointer'

        if (chrome.runtime.lastError) {
          const errorMsg = chrome.runtime.lastError.message
          log('error', '❌ 发送消息失败', chrome.runtime.lastError)
          showNotification(`添加书签失败：${errorMsg}`, 'error')
          return
        }

        if (response?.success) {
          const bookmarkId = response.bookmarkId

          // ✅ 如果勾选了收藏，添加到收藏
          if (isFavorite && bookmarkId) {
            try {
              chrome.runtime.sendMessage(
                {
                  type: 'ADD_TO_FAVORITES',
                  data: { bookmarkId }
                },
                favoriteResponse => {
                  if (favoriteResponse?.success) {
                    log('info', '⭐ 书签已添加到收藏', { bookmarkId })
                  }
                }
              )
            } catch (error) {
              log('warn', '添加到收藏失败', error)
            }
          }

          log('info', '✅ 书签添加成功', { title, url, isFavorite })
          const successMsg = isFavorite
            ? '✅ 书签已添加并收藏'
            : '✅ 书签已添加'
          showNotification(successMsg, 'success')
          // 延迟关闭，让用户看到成功消息
          setTimeout(() => {
            handleClose()
          }, 800)
        } else {
          const errorMsg = response?.error || '未知错误'
          log('error', '❌ 添加书签失败', { error: errorMsg })
          showNotification(`添加书签失败：${errorMsg}`, 'error')
        }
      }
    )
  }

  // 点击遮罩层关闭
  overlay.addEventListener('click', e => {
    if (e.target === overlay) {
      handleClose()
    }
  })
}

/**
 * 创建树形文件夹选择器
 *
 * @param container - 容器元素
 * @param onSelect - 选择回调函数
 * @returns 控制函数
 */
function createFolderTreeSelector(
  container: HTMLElement,
  onSelect: (folderId: string) => void
): {
  updateTree: (tree: chrome.bookmarks.BookmarkTreeNode[]) => void
  getSelectedFolderId: () => string
  setSelectedFolderId: (folderId: string) => void
} {
  let selectedFolderId = ''
  const expandedFolders = new Set<string>()

  // 清除容器内容
  function clear() {
    container.innerHTML = ''
  }

  // 创建文件夹项（完全复刻 Chrome 原生样式）
  function createFolderItem(
    node: chrome.bookmarks.BookmarkTreeNode,
    level: number,
    parentContainer: HTMLElement
  ): void {
    if (node.url) {
      return // 跳过书签，只显示文件夹
    }

    const item = document.createElement('div')
    item.setAttribute('data-folder-id', node.id)
    item.setAttribute('data-level', level.toString())
    item.style.cssText = `
      display: flex;
      align-items: center;
      padding: 2px 4px;
      padding-left: ${4 + level * 16}px;
      cursor: pointer;
      user-select: none;
      font-size: 13px;
      color: #202124;
      transition: background-color 0.1s ease;
      min-height: 24px;
      line-height: 20px;
    `

    // 展开/折叠图标（Chrome 原生样式：实心三角形）
    const expandIcon = document.createElement('span')
    expandIcon.style.cssText = `
      display: inline-block;
      width: 12px;
      height: 12px;
      margin-right: 4px;
      vertical-align: middle;
      flex-shrink: 0;
      font-size: 10px;
      line-height: 12px;
      text-align: center;
      color: #5f6368;
    `

    const hasChildren = node.children && node.children.some(child => !child.url)
    if (hasChildren) {
      // Chrome 使用 Unicode 三角形：▶ (U+25B6) 和 ▼ (U+25BC)
      expandIcon.textContent = expandedFolders.has(node.id) ? '▼' : '▶'
      expandIcon.style.cursor = 'pointer'
      expandIcon.style.fontSize = '10px'
      expandIcon.addEventListener('click', e => {
        e.stopPropagation()
        toggleFolder(node.id)
      })
      // 悬停效果
      expandIcon.addEventListener('mouseenter', () => {
        expandIcon.style.color = '#202124'
      })
      expandIcon.addEventListener('mouseleave', () => {
        expandIcon.style.color = '#5f6368'
      })
    } else {
      // 没有子文件夹时，使用透明的占位符保持对齐
      expandIcon.style.width = '12px'
      expandIcon.style.visibility = 'hidden'
    }

    // 文件夹图标（Chrome 原生：所有文件夹统一使用 📁，选中时不改变）
    const folderIcon = document.createElement('span')
    folderIcon.textContent = '📁'
    folderIcon.style.cssText = `
      margin-right: 8px;
      font-size: 16px;
      flex-shrink: 0;
      line-height: 1;
      display: inline-flex;
      align-items: center;
    `

    // 文件夹名称（Chrome 原生样式）
    const folderName = document.createElement('span')
    folderName.textContent = node.title
    folderName.style.cssText = `
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 13px;
      color: inherit;
    `

    item.appendChild(expandIcon)
    item.appendChild(folderIcon)
    item.appendChild(folderName)

    // 选中状态样式（只改变背景和文字颜色，不改变图标）
    function updateSelectedStyle() {
      if (item.getAttribute('data-folder-id') === selectedFolderId) {
        item.style.backgroundColor = '#e8f0fe'
        item.style.color = '#1a73e8'
      } else {
        item.style.backgroundColor = 'transparent'
        item.style.color = '#202124'
      }
    }

    // 点击选择
    item.addEventListener('click', e => {
      if (e.target !== expandIcon) {
        selectFolder(node.id)
      }
    })

    // 悬停效果（Chrome 原生：浅灰色背景）
    item.addEventListener('mouseenter', () => {
      if (item.getAttribute('data-folder-id') !== selectedFolderId) {
        item.style.backgroundColor = '#f8f9fa'
      }
    })
    item.addEventListener('mouseleave', () => {
      updateSelectedStyle()
    })

    parentContainer.appendChild(item)

    // 子文件夹容器（可折叠）- 但不在这里渲染子节点
    // 子节点的渲染由 renderFolderRecursive 统一处理，避免重复
    if (hasChildren) {
      const childrenContainer = document.createElement('div')
      childrenContainer.setAttribute('data-children-of', node.id)
      childrenContainer.style.cssText = `
        display: ${expandedFolders.has(node.id) ? 'block' : 'none'};
      `
      parentContainer.appendChild(childrenContainer)
      // 注意：不在这里渲染子节点，由 renderFolderRecursive 统一处理
    }

    updateSelectedStyle()
  }

  // 展开/折叠文件夹
  function toggleFolder(folderId: string): void {
    if (expandedFolders.has(folderId)) {
      expandedFolders.delete(folderId)
    } else {
      expandedFolders.add(folderId)
    }
    // 重新渲染树
    const tree = getCurrentTree()
    if (tree) {
      updateTree(tree)
    }
  }

  // 选择文件夹
  function selectFolder(folderId: string): void {
    selectedFolderId = folderId
    updateSelectedStyles()
    onSelect(folderId)
  }

  // 更新所有项的选中样式（只改变背景和文字颜色，不改变图标）
  function updateSelectedStyles(): void {
    const items = container.querySelectorAll('[data-folder-id]')
    items.forEach(item => {
      const folderId = item.getAttribute('data-folder-id')
      if (folderId === selectedFolderId) {
        item.setAttribute('data-selected', 'true')
        const htmlItem = item as HTMLElement
        htmlItem.style.backgroundColor = '#e8f0fe'
        htmlItem.style.color = '#1a73e8'
        // 滚动到选中项
        htmlItem.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } else {
        item.removeAttribute('data-selected')
        const htmlItem = item as HTMLElement
        htmlItem.style.backgroundColor = 'transparent'
        htmlItem.style.color = '#202124'
      }
    })
  }

  let currentTree: chrome.bookmarks.BookmarkTreeNode[] | null = null

  // 保存当前树数据
  function getCurrentTree(): chrome.bookmarks.BookmarkTreeNode[] | null {
    return currentTree
  }

  // 递归渲染文件夹及其子文件夹
  function renderFolderRecursive(
    node: chrome.bookmarks.BookmarkTreeNode,
    level: number,
    parentContainer: HTMLElement,
    renderedNodeIds: Set<string>
  ): void {
    if (node.url) {
      return // 跳过书签
    }

    // 防止重复渲染同一个节点
    if (renderedNodeIds.has(node.id)) {
      log('warn', `节点 ${node.id} (${node.title}) 已渲染，跳过重复渲染`)
      return
    }

    renderedNodeIds.add(node.id)

    // 创建文件夹项
    createFolderItem(node, level, parentContainer)

    // 如果有子文件夹且已展开，递归渲染
    if (node.children && expandedFolders.has(node.id)) {
      const childrenContainer = parentContainer.querySelector(
        `[data-children-of="${node.id}"]`
      ) as HTMLElement
      if (childrenContainer) {
        for (const child of node.children) {
          renderFolderRecursive(
            child,
            level + 1,
            childrenContainer,
            renderedNodeIds
          )
        }
      }
    }
  }

  // 更新树
  function updateTree(tree: chrome.bookmarks.BookmarkTreeNode[]): void {
    currentTree = tree
    clear()

    // 使用 Set 跟踪已渲染的节点 ID，避免重复渲染
    const renderedNodeIds = new Set<string>()

    // 自动展开书签栏
    for (const rootNode of tree) {
      if (rootNode.children) {
        for (const child of rootNode.children) {
          if (
            !child.url &&
            (child.title === '书签栏' || child.title === 'Bookmarks Bar')
          ) {
            expandedFolders.add(child.id)
            break
          }
        }
      }
    }

    // 如果已选中文件夹，展开到该文件夹的路径
    if (selectedFolderId) {
      expandPathToNode(selectedFolderId, tree)
    }

    // 只渲染根节点的直接子文件夹（不渲染根节点本身）
    // Chrome 书签树通常只有一个根节点（id: "0"）
    for (const rootNode of tree) {
      // 跳过根节点本身的渲染，只渲染其子节点
      if (rootNode.children) {
        for (const child of rootNode.children) {
          // 只渲染文件夹（跳过书签）
          // 注意：不要在这里提前添加到 renderedNodeIds，让 renderFolderRecursive 自己处理
          if (!child.url) {
            renderFolderRecursive(child, 0, container, renderedNodeIds)
          }
        }
      }
    }

    log('info', `✅ 渲染完成，共渲染了 ${renderedNodeIds.size} 个文件夹节点`)

    updateSelectedStyles()
  }

  // 辅助函数：查找节点
  function findNodeById(
    id: string,
    nodes: chrome.bookmarks.BookmarkTreeNode[]
  ): chrome.bookmarks.BookmarkTreeNode | null {
    for (const node of nodes) {
      if (node.id === id) {
        return node
      }
      if (node.children) {
        const found = findNodeById(id, node.children)
        if (found) {
          return found
        }
      }
    }
    return null
  }

  // 辅助函数：查找节点的父节点
  function findParentNode(
    targetId: string,
    nodes: chrome.bookmarks.BookmarkTreeNode[],
    parent: chrome.bookmarks.BookmarkTreeNode | null = null
  ): chrome.bookmarks.BookmarkTreeNode | null {
    for (const node of nodes) {
      if (node.id === targetId) {
        return parent
      }
      if (node.children) {
        const found = findParentNode(targetId, node.children, node)
        if (found !== null) {
          return found
        }
      }
    }
    return null
  }

  // 辅助函数：展开到目标节点的路径
  function expandPathToNode(
    targetId: string,
    tree: chrome.bookmarks.BookmarkTreeNode[]
  ): void {
    let current: chrome.bookmarks.BookmarkTreeNode | null = findNodeById(
      targetId,
      tree
    )
    while (current) {
      const parent = findParentNode(current.id, tree)
      if (parent) {
        expandedFolders.add(parent.id)
        current = parent
      } else {
        break
      }
    }
  }

  return {
    updateTree,
    getSelectedFolderId: () => selectedFolderId,
    setSelectedFolderId: (folderId: string) => {
      selectedFolderId = folderId
      updateSelectedStyles()
    }
  }
}

/**
 * 加载文件夹树数据
 *
 * @param updateTree - 更新树的回调函数
 */
async function loadFolderTree(
  updateTree: (tree: chrome.bookmarks.BookmarkTreeNode[]) => void
): Promise<void> {
  try {
    log('info', '📥 [loadFolderTree] 开始加载文件夹树...')
    console.log('[ContentScript:QuickAdd] 开始加载文件夹树')

    // 使用 Promise 包装 sendMessage，确保能正确处理异步响应
    const response = await new Promise<{
      success?: boolean
      tree?: chrome.bookmarks.BookmarkTreeNode[]
      error?: string
    }>((resolve, reject) => {
      log('info', '📤 [loadFolderTree] 发送 GET_BOOKMARK_TREE 消息...')
      console.log('[ContentScript:QuickAdd] 发送 GET_BOOKMARK_TREE 消息')

      chrome.runtime.sendMessage(
        {
          type: 'GET_BOOKMARK_TREE'
        },
        response => {
          if (chrome.runtime.lastError) {
            const error = chrome.runtime.lastError.message
            log('error', '❌ [loadFolderTree] chrome.runtime.lastError', error)
            console.error(
              '[ContentScript:QuickAdd] chrome.runtime.lastError:',
              error
            )
            reject(new Error(error))
            return
          }

          if (!response) {
            log('error', '❌ [loadFolderTree] 未收到响应')
            console.error('[ContentScript:QuickAdd] 未收到响应')
            reject(new Error('未收到响应'))
            return
          }

          log('info', '✅ [loadFolderTree] 收到响应', {
            success: response.success,
            hasTree: !!response.tree,
            treeLength: response.tree?.length || 0
          })
          console.log('[ContentScript:QuickAdd] 收到响应:', response)
          resolve(response)
        }
      )
    })

    if (!response.success) {
      log('error', '获取书签树失败', response.error)
      return
    }

    const tree = response.tree
    if (!tree || !Array.isArray(tree) || tree.length === 0) {
      log('error', '书签树数据无效', { tree })
      return
    }

    log('info', '✅ 收到书签树数据', {
      rootNodes: tree.length,
      hasBookmarksBar: tree.some(node =>
        node.children?.some(
          child => child.title === '书签栏' || child.title === 'Bookmarks Bar'
        )
      )
    })

    // 更新树
    updateTree(tree)
    log('info', '✅ 文件夹树已渲染')
  } catch (error) {
    log('error', '加载文件夹树失败', error)

    // 显示错误提示
    const errorDiv = document.createElement('div')
    errorDiv.style.cssText = `
      padding: 12px;
      background: #fee;
      border: 1px solid #fcc;
      border-radius: 4px;
      color: #c33;
      font-size: 12px;
    `
    errorDiv.textContent = `加载文件夹失败: ${error instanceof Error ? error.message : String(error)}`

    const container = document.getElementById('acuity-folder-tree')
    if (container) {
      container.appendChild(errorDiv)
    }
  }
}

/**
 * 查找书签栏 ID
 *
 * @param container - 树形容器
 * @returns 书签栏的 ID，如果不存在则返回 null
 */
function findBookmarksBarId(container: HTMLElement): string | null {
  const bookmarksBarItem = container.querySelector(
    '[data-folder-id][data-folder-name="书签栏"], [data-folder-id][data-folder-name="Bookmarks Bar"]'
  )
  if (bookmarksBarItem) {
    return bookmarksBarItem.getAttribute('data-folder-id')
  }

  // 如果没有找到，遍历所有项查找
  const items = container.querySelectorAll('[data-folder-id]')
  for (const item of Array.from(items)) {
    const folderNameElement = item.querySelector('span:last-child')
    if (folderNameElement) {
      const folderName = folderNameElement.textContent?.trim()
      if (folderName === '书签栏' || folderName === 'Bookmarks Bar') {
        return item.getAttribute('data-folder-id')
      }
    }
  }

  return null
}

/**
 * 获取 AI 建议
 */
async function getAISuggestion(
  title: string,
  url: string
): Promise<{ folderId: string; folderName: string } | null> {
  try {
    const response = (await new Promise<chrome.runtime.MessageSender>(
      (resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            type: 'GET_AI_CATEGORY_SUGGESTION',
            data: { title, url }
          },
          response => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError)
            } else {
              resolve(response as chrome.runtime.MessageSender)
            }
          }
        )
      }
    )) as { success?: boolean; category?: string; error?: string }

    if (response?.success && response?.category) {
      // 查找对应的文件夹（通过消息获取书签树）
      const treeResponse = (await new Promise<chrome.runtime.MessageSender>(
        (resolve, reject) => {
          chrome.runtime.sendMessage(
            { type: 'GET_BOOKMARK_TREE' },
            response => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError)
              } else {
                resolve(response as chrome.runtime.MessageSender)
              }
            }
          )
        }
      )) as { success?: boolean; tree?: chrome.bookmarks.BookmarkTreeNode[] }

      if (treeResponse?.success && treeResponse?.tree) {
        let folderId: string | null = null
        const folderName = response.category

        function findFolder(nodes: chrome.bookmarks.BookmarkTreeNode[]): void {
          for (const node of nodes) {
            if (!node.url && node.title === response.category) {
              folderId = node.id
              return
            }
            if (node.children) {
              findFolder(node.children)
            }
          }
        }

        findFolder(treeResponse.tree)

        if (folderId) {
          return { folderId, folderName }
        }
      }
    }
  } catch (error) {
    log('error', '获取 AI 建议失败', error)
  }

  return null
}

/**
 * 显示通知
 *
 * @param message - 通知消息
 * @param type - 通知类型：'success' | 'error' | 'warning' | 'info'
 */
function showNotification(
  message: string,
  type: 'success' | 'error' | 'warning' | 'info' = 'info'
): void {
  // 如果已有通知，先移除
  const existingNotification = document.getElementById('acuity-notification')
  if (existingNotification) {
    existingNotification.remove()
  }

  const notification = document.createElement('div')
  notification.id = 'acuity-notification'

  // 根据类型设置样式
  const typeStyles = {
    success: {
      background: '#34a853',
      color: '#ffffff',
      icon: '✓'
    },
    error: {
      background: '#ea4335',
      color: '#ffffff',
      icon: '✕'
    },
    warning: {
      background: '#fbbc04',
      color: '#202124',
      icon: '⚠'
    },
    info: {
      background: '#4285f4',
      color: '#ffffff',
      icon: 'ℹ'
    }
  }

  const style = typeStyles[type]

  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: ${style.background};
    color: ${style.color};
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    font-size: 14px;
    font-weight: 500;
    z-index: 2147483648;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 200px;
    max-width: 400px;
    animation: slideInRight 0.3s ease-out;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  `

  // 添加图标
  const icon = document.createElement('span')
  icon.textContent = style.icon
  icon.style.cssText = `
    font-size: 16px;
    font-weight: bold;
    flex-shrink: 0;
  `

  // 添加消息文本
  const text = document.createElement('span')
  text.textContent = message
  text.style.cssText = `
    flex: 1;
    word-wrap: break-word;
  `

  notification.appendChild(icon)
  notification.appendChild(text)

  // 添加动画样式（如果还没有）
  if (!document.getElementById('acuity-notification-styles')) {
    const styleSheet = document.createElement('style')
    styleSheet.id = 'acuity-notification-styles'
    styleSheet.textContent = `
      @keyframes slideInRight {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes slideOutRight {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }
    `
    document.head.appendChild(styleSheet)
  }

  document.body.appendChild(notification)

  // 根据类型设置不同的显示时长
  const duration = type === 'error' ? 5000 : type === 'warning' ? 4000 : 3000

  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease-out'
    setTimeout(() => {
      notification.remove()
    }, 300)
  }, duration)
}

/**
 * 监听来自 background 的消息
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // 心跳检测：确认脚本已加载并准备好
  if (message.type === 'PING_QUICK_ADD_DIALOG') {
    sendResponse({ ready: true })
    return true
  }

  // 显示对话框
  if (message.type === 'SHOW_QUICK_ADD_DIALOG') {
    const data = message.data || {}
    if (data.url && data.title) {
      try {
        createNativeStyleDialog({
          title: data.title,
          url: data.url,
          favIconUrl: data.favIconUrl
        })
        sendResponse({ success: true })
      } catch (error) {
        log('error', '创建对话框失败', error)
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    } else {
      log('error', '缺少必要的数据', data)
      sendResponse({ success: false, error: 'Missing required data' })
    }
    return true
  }

  return false
})

log('info', '✅ Content script 已加载并准备好')
