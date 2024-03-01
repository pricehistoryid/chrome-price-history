async function getProfileUserInfo() {
  var resp = await chrome.runtime.sendMessage({ type: "getProfileUserInfo" });
  return resp;
}