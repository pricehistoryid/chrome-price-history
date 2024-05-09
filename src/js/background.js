chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.type === "getProfileUserInfo") {
    chrome.identity.getProfileUserInfo(function(userInfo) {
      sendResponse({
        id: userInfo.id,
        email: userInfo.email 
      });
    });
    return true;
  }
});