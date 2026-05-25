import { render } from 'preact';
import './styles/global.css';
import { NewTab } from './components/NewTab';

async function boot() {
  // Dev-only: install an in-memory chrome.* mock so the page runs in a plain
  // browser (vite dev / Playwright). Tree-shaken out of the production
  // extension build, where import.meta.env.DEV === false.
  if (import.meta.env.DEV) await import('./lib/dev-chrome-shim');
  render(<NewTab />, document.getElementById('app')!);
}

void boot();
