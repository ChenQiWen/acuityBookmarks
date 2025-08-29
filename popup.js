document.addEventListener('DOMContentLoaded', function() {
  const restructureBtn = document.getElementById('restructureBtn');

  restructureBtn.addEventListener('click', function() {
    chrome.runtime.sendMessage({ action: 'startRestructure' });
  });
});
