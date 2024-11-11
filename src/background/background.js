// chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
//   if (request.type === "getProfileUserInfo") {
//     chrome.identity.getProfileUserInfo(function (userInfo) {
//       sendResponse({
//         id: userInfo.id,
//         email: userInfo.email
//       });
//     });
//     return true;
//   }
// });

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if (changeInfo.url && changeInfo.url.match('https:\/\/.*.tokopedia.com\/.*\/.*')) {
    if (changeInfo.url.indexOf("#") === -1) {
      let url = changeInfo.url;
      url = url.replace(/^https?:\/\//, '');
      chrome.tabs.sendMessage(tabId, {
        type: 'urlChanged',
        url: url
      })
    }
  }
});
