document.addEventListener('DOMContentLoaded', function() {
  const restructureBtn = document.getElementById('restructureBtn');
  const loadingIndicator = document.getElementById('loadingIndicator');

  restructureBtn.addEventListener('click', function() {
    restructureBtn.classList.add('disabled');
    loadingIndicator.style.display = 'block';
    chrome.runtime.sendMessage({ action: 'startRestructure' });
  });
});
