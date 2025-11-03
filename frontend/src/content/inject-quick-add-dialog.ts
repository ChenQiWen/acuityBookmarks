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

  // 标题栏（模拟 Chrome 原生）
  const titleBar = document.createElement('div')
  titleBar.style.cssText = `
    padding: 16px 20px;
    border-bottom: 1px solid #e0e0e0;
    font-size: 16px;
    font-weight: 500;
    color: #202124;
    background: #ffffff;
  `
  titleBar.textContent = '添加书签'

  // 内容区域
  const content = document.createElement('div')
  content.style.cssText = `
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  `

  // 名称输入框
  const nameLabel = document.createElement('label')
  nameLabel.style.cssText = `
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: #5f6368;
    margin-bottom: 8px;
  `
  nameLabel.textContent = '名称'

  const nameInput = document.createElement('input')
  nameInput.type = 'text'
  nameInput.value = data.title
  nameInput.placeholder = '书签名称'
  nameInput.style.cssText = `
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #dadce0;
    border-radius: 4px;
    font-size: 14px;
    color: #202124;
    background: #ffffff;
    outline: none;
    box-sizing: border-box;
  `
  nameInput.addEventListener('focus', () => {
    nameInput.style.borderColor = '#1a73e8'
    nameInput.style.boxShadow = '0 0 0 2px rgba(26, 115, 232, 0.15)'
  })
  nameInput.addEventListener('blur', () => {
    nameInput.style.borderColor = '#dadce0'
    nameInput.style.boxShadow = 'none'
  })
  nameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleConfirm()
    }
    if (e.key === 'Escape') {
      handleClose()
    }
  })

  // 文件夹选择
  const folderLabel = document.createElement('label')
  folderLabel.style.cssText = `
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: #5f6368;
    margin-bottom: 8px;
  `
  folderLabel.textContent = '文件夹'

  const folderSelect = document.createElement('select')
  folderSelect.style.cssText = `
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #dadce0;
    border-radius: 4px;
    font-size: 14px;
    color: #202124;
    background: #ffffff;
    outline: none;
    box-sizing: border-box;
    cursor: pointer;
  `
  folderSelect.addEventListener('focus', () => {
    folderSelect.style.borderColor = '#1a73e8'
    folderSelect.style.boxShadow = '0 0 0 2px rgba(26, 115, 232, 0.15)'
  })
  folderSelect.addEventListener('blur', () => {
    folderSelect.style.borderColor = '#dadce0'
    folderSelect.style.boxShadow = 'none'
  })

  // 加载文件夹列表
  loadFolders(folderSelect)

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
    folderSelect.value = aiButton.dataset.folderId || ''
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
      if (!folderSelect.value) {
        folderSelect.value = suggestion.folderId
      }
    }
  })

  // 组装内容
  const nameGroup = document.createElement('div')
  nameGroup.appendChild(nameLabel)
  nameGroup.appendChild(nameInput)

  const folderGroup = document.createElement('div')
  folderGroup.appendChild(folderLabel)
  folderGroup.appendChild(folderSelect)

  content.appendChild(nameGroup)
  content.appendChild(folderGroup)
  content.appendChild(aiSuggestionDiv)

  // 按钮栏
  const buttonBar = document.createElement('div')
  buttonBar.style.cssText = `
    padding: 16px 20px;
    border-top: 1px solid #e0e0e0;
    background: #f8f9fa;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  `

  const cancelButton = document.createElement('button')
  cancelButton.textContent = '取消'
  cancelButton.style.cssText = `
    padding: 8px 16px;
    border: 1px solid #dadce0;
    border-radius: 4px;
    background: #ffffff;
    color: #5f6368;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    outline: none;
  `
  cancelButton.addEventListener('click', handleClose)
  cancelButton.addEventListener('mouseenter', () => {
    cancelButton.style.backgroundColor = '#f8f9fa'
  })
  cancelButton.addEventListener('mouseleave', () => {
    cancelButton.style.backgroundColor = '#ffffff'
  })

  const saveButton = document.createElement('button')
  saveButton.textContent = '保存'
  saveButton.style.cssText = `
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    background: #1a73e8;
    color: #ffffff;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    outline: none;
  `
  saveButton.addEventListener('click', handleConfirm)
  saveButton.addEventListener('mouseenter', () => {
    saveButton.style.backgroundColor = '#1557b0'
  })
  saveButton.addEventListener('mouseleave', () => {
    saveButton.style.backgroundColor = '#1a73e8'
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
  }, 100)

  // 关闭对话框
  function handleClose(): void {
    overlay.remove()
  }

  // 确认保存
  function handleConfirm(): void {
    const title = nameInput.value.trim()
    const folderId = folderSelect.value

    if (!title) {
      alert('请输入书签名称')
      return
    }

    if (!folderId) {
      alert('请选择文件夹')
      return
    }

    // 发送消息到 background 创建书签
    chrome.runtime.sendMessage(
      {
        type: 'CREATE_BOOKMARK',
        data: {
          title,
          url: data.url,
          parentId: folderId
        }
      },
      response => {
        if (chrome.runtime.lastError) {
          log('error', '发送消息失败', chrome.runtime.lastError)
          alert('添加书签失败：' + chrome.runtime.lastError.message)
          return
        }

        if (response?.success) {
          log('info', '✅ 书签添加成功')
          handleClose()
          // 显示通知（可选）
          showNotification('书签已添加')
        } else {
          log('error', '添加书签失败', response?.error)
          alert('添加书签失败：' + (response?.error || '未知错误'))
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
 * 加载文件夹列表
 */
async function loadFolders(select: HTMLSelectElement): Promise<void> {
  try {
    // Content script 不能直接访问 chrome.bookmarks，需要通过消息传递
    // 但这里我们可以直接使用 chrome.bookmarks API（因为 manifest 中有 bookmarks 权限）
    // 实际上，content script 可以访问 chrome.bookmarks，但需要通过 sendMessage
    // 为了简化，我们直接使用 chrome.bookmarks API（某些浏览器允许）

    // 方案：通过消息获取文件夹树
    chrome.runtime.sendMessage(
      {
        type: 'GET_BOOKMARK_TREE'
      },
      response => {
        if (chrome.runtime.lastError) {
          log('error', '获取书签树失败', chrome.runtime.lastError)
          return
        }

        if (!response || !response.success) {
          log('error', '获取书签树失败', response?.error)
          return
        }

        const folders: Array<{ label: string; value: string }> = []

        function traverse(
          nodes: chrome.bookmarks.BookmarkTreeNode[],
          prefix = ''
        ): void {
          for (const node of nodes) {
            if (!node.url) {
              const label = prefix ? `${prefix} > ${node.title}` : node.title
              folders.push({ label, value: node.id })
              if (node.children) {
                traverse(node.children, label)
              }
            }
          }
        }

        traverse(response.tree || [])

        folders.forEach(folder => {
          const option = document.createElement('option')
          option.value = folder.value
          option.textContent = folder.label
          select.appendChild(option)
        })

        // 默认选择书签栏
        const bookmarksBar = folders.find(
          f => f.label === '书签栏' || f.label === 'Bookmarks Bar'
        )
        if (bookmarksBar) {
          select.value = bookmarksBar.value
        } else if (folders.length > 0) {
          select.value = folders[0].value
        }
      }
    )
  } catch (error) {
    log('error', '加载文件夹列表失败', error)
  }
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
 */
function showNotification(message: string): void {
  const notification = document.createElement('div')
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #202124;
    color: #ffffff;
    padding: 12px 16px;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    font-size: 13px;
    z-index: 2147483648;
  `
  notification.textContent = message
  document.body.appendChild(notification)

  setTimeout(() => {
    notification.remove()
  }, 3000)
}

/**
 * 监听来自 background 的消息
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SHOW_QUICK_ADD_DIALOG') {
    const data = message.data || {}
    if (data.url && data.title) {
      createNativeStyleDialog({
        title: data.title,
        url: data.url,
        favIconUrl: data.favIconUrl
      })
      sendResponse({ success: true })
    } else {
      log('error', '缺少必要的数据', data)
      sendResponse({ success: false, error: 'Missing required data' })
    }
    return true
  }
})

log('info', 'Content script 已加载')
