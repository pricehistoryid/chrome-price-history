import './content/v3/css/style.css'
import { main } from './content/v3/event-listener'

export default defineContentScript({
  matches: [
    '*://*.tokopedia.com/*'
  ],
  runAt: 'document_end',
  main() {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      main();
    } else {
      window.addEventListener('DOMContentLoaded', main, { once: true });
    }
  },
});
