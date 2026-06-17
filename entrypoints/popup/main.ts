// entrypoints/popup/main.ts

document.addEventListener('DOMContentLoaded', async () => {
  const statusDisplay = document.querySelector('.card-title');
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;

    if (tab.url.includes('tokopedia.com')) {
      if (statusDisplay) statusDisplay.textContent = 'Tracking: Active';
    } else {
      if (statusDisplay) statusDisplay.textContent = 'Tracking: Inactive';
    }
  } catch (e) {
    console.error('Popup error:', e);
  }
});
