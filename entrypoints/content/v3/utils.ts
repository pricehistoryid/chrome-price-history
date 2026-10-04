export function waitForElement<T extends Element>(
  selector: string,
  timeout = 2000,
): Promise<T | null> {
  return new Promise(resolve => {
    const el = document.querySelector<T>(selector);
    if (el) return resolve(el);

    const observer = new MutationObserver(() => {
      const el = document.querySelector<T>(selector);
      if (el) {
        clearTimeout(timer);
        observer.disconnect();
        resolve(el);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const timer = setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

export function sleep(ms: number): Promise<void> {
  // ponytail: plain Promise + setTimeout. Promise.withResolvers would be
  // shorter, but it is ES2024, and the build ships `esnext` untranspiled to
  // content scripts running in whatever browser the user has.
  return new Promise(resolve => setTimeout(resolve, ms));
}
