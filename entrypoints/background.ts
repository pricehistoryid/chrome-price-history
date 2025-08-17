export default defineBackground(() => {
  chrome.tabs.onUpdated.addListener(
    (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, _tab: chrome.tabs.Tab) => {
      const url = changeInfo.url;

      if (
        url &&
        /^https:\/\/.*\.tokopedia\.com\/.+/.test(url)
      ) {
        const cleanedUrl = url.replace(/^https?:\/\//, '');

        chrome.tabs.sendMessage(tabId, {
          type: 'urlChanged',
          url: cleanedUrl
        }).catch(err => {
          console.warn('No receiver for message:', err);
        });
      }
    }
  );
});
