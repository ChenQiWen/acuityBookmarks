document.addEventListener('DOMContentLoaded', function() {
  const restructureBtn = document.getElementById('restructureBtn');
  const loadingIndicator = document.getElementById('loadingIndicator');
  const loadingText = document.getElementById('loadingText');
  const settingsBtn = document.getElementById('settingsBtn');
  const helpBtn = document.getElementById('helpBtn');

  // 全局消息监听器 - 只添加一次
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'restructureComplete') {
      // 恢复按钮状态
      if (restructureBtn) {
        restructureBtn.classList.remove('disabled');
        restructureBtn.innerHTML = '<i class="material-icons left">auto_fix_high</i>开始智能整理';
      }
      
      // 隐藏加载状态
      if (loadingIndicator) loadingIndicator.style.display = 'none';
      if (loadingText) loadingText.style.display = 'none';
      
      // 显示成功消息
      showSuccessMessage();
      
      return true; // 保持消息端口开放
    }
    
    if (request.action === 'aiServiceUnavailable') {
      // AI服务不可用，显示警告并切换到本地模式
      if (loadingText) {
        loadingText.innerHTML = '⚠️ AI服务暂不可用，使用本地智能分类...';
        loadingText.style.color = '#ff9800';
      }
      
      // 显示警告消息
      showWarningMessage('AI服务暂不可用', '已自动切换到本地智能分类模式');
      
      return true;
    }
  });

  restructureBtn.addEventListener('click', function() {
    try {
      // 禁用按钮并显示加载状态
      restructureBtn.classList.add('disabled');
      restructureBtn.innerHTML = '<i class="material-icons left">hourglass_empty</i>分析中...';
      
      // 显示加载动画和文本
      loadingIndicator.style.display = 'block';
      loadingText.style.display = 'block';
      
      // 发送消息给background script
      chrome.runtime.sendMessage({ action: 'startRestructure' }, function(response) {
        if (chrome.runtime.lastError) {
          console.error('Error sending message:', chrome.runtime.lastError);
          // 如果发送失败，恢复按钮状态
          restructureBtn.classList.remove('disabled');
          restructureBtn.innerHTML = '<i class="material-icons left">auto_fix_high</i>开始智能整理';
          loadingIndicator.style.display = 'none';
          loadingText.style.display = 'none';
        }
      });
    } catch (error) {
      console.error('Error in restructure button click:', error);
      // 恢复按钮状态
      restructureBtn.classList.remove('disabled');
      restructureBtn.innerHTML = '<i class="material-icons left">auto_fix_high</i>开始智能整理';
      loadingIndicator.style.display = 'none';
      loadingText.style.display = 'none';
    }
  });

  // 设置按钮事件
  settingsBtn.addEventListener('click', function(e) {
    e.preventDefault();
    // 这里可以添加设置页面的逻辑
    console.log('设置功能暂未实现');
  });

  // 帮助按钮事件
  helpBtn.addEventListener('click', function(e) {
    e.preventDefault();
    // 打开帮助文档
    chrome.tabs.create({ 
      url: 'https://github.com/your-username/acuity-bookmarks#readme' 
    });
  });

  // 显示成功消息
  function showSuccessMessage() {
    const content = document.querySelector('.popup-content');
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.innerHTML = `
      <div style="text-align: center; padding: 16px 0;">
        <i class="material-icons" style="font-size: 48px; color: var(--md-success); margin-bottom: 12px;">check_circle</i>
        <p style="margin: 0; color: var(--md-success); font-weight: 500;">分析完成！</p>
        <p style="margin: 8px 0 0; font-size: 13px; color: var(--md-on-surface-variant);">管理页面即将打开</p>
      </div>
    `;
    
    content.appendChild(successDiv);
    
    // 3秒后移除成功消息
    setTimeout(() => {
      if (successDiv.parentNode) {
        successDiv.parentNode.removeChild(successDiv);
      }
    }, 3000);
  }

  // 显示警告消息
  function showWarningMessage(title, subtitle) {
    const content = document.querySelector('.popup-content');
    const warningDiv = document.createElement('div');
    warningDiv.className = 'warning-message';
    warningDiv.innerHTML = `
      <div style="text-align: center; padding: 16px 0; background: rgba(255, 152, 0, 0.1); border-radius: 8px; margin: 16px 0;">
        <i class="material-icons" style="font-size: 40px; color: #ff9800; margin-bottom: 8px;">warning</i>
        <p style="margin: 0; color: #ff9800; font-weight: 500; font-size: 14px;">${title}</p>
        <p style="margin: 8px 0 0; font-size: 12px; color: var(--md-on-surface-variant);">${subtitle}</p>
      </div>
    `;
    
    content.appendChild(warningDiv);
    
    // 5秒后移除警告消息
    setTimeout(() => {
      if (warningDiv.parentNode) {
        warningDiv.parentNode.removeChild(warningDiv);
      }
    }, 5000);
  }
});
