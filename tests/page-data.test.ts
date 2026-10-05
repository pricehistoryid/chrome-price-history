import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { amountFrom, amountsIn, jsonLdNodes, textOf, waitFor, watchText } from '../entrypoints/content/v3/scraper/page-data';

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.useRealTimers();
});

describe('amountsIn', () => {
  it('reads thousands-separated rupiah', () => {
    expect(amountsIn('Rp185.000')).toEqual([185000]);
    expect(amountsIn('1.845.000')).toEqual([1845000]);
    expect(amountsIn('Rp1.600.000 - Rp1.700.000')).toEqual([1600000, 1700000]);
  });

  it('answers nothing for text with no figure', () => {
    expect(amountsIn('Rp -')).toEqual([]);
    expect(amountsIn('')).toEqual([]);
  });

  it('takes only the first figure when asked for one', () => {
    expect(amountFrom('Rp1.600.000 - Rp1.700.000')).toBe(1600000);
    expect(amountFrom('no price here')).toBeNull();
  });
});

describe('jsonLdNodes', () => {
  it('returns only the requested type, skipping malformed blocks', () => {
    document.head.innerHTML = `
      <script type="application/ld+json">{"@type":"BreadcrumbList"}</script>
      <script type="application/ld+json">{ not json </script>
      <script type="application/ld+json">[{"@type":"Product","name":"A"},{"@type":"Product","name":"B"}]</script>`;

    expect(jsonLdNodes('Product').map((node) => node.name)).toEqual(['A', 'B']);
  });
});

describe('textOf', () => {
  it('reads trimmed text, or nothing when the element is absent', () => {
    document.body.innerHTML = '<div class="price">  Rp1.000  </div>';

    expect(textOf('.price')).toBe('Rp1.000');
    expect(textOf('.missing')).toBe('');
  });
});

describe('waitFor', () => {
  it('answers immediately when the read succeeds', async () => {
    await expect(waitFor(() => 'ready', 1000)).resolves.toBe('ready');
  });

  it('polls until the value appears', async () => {
    vi.useFakeTimers();
    let value: string | null = null;
    const pending = waitFor(() => value, 600, 100);

    await vi.advanceTimersByTimeAsync(150);
    value = 'late';
    await vi.advanceTimersByTimeAsync(150);

    await expect(pending).resolves.toBe('late');
  });

  it('gives up after the timeout', async () => {
    vi.useFakeTimers();
    const pending = waitFor(() => null, 300, 100);

    await vi.advanceTimersByTimeAsync(400);

    await expect(pending).resolves.toBeNull();
  });
});

describe('watchText', () => {
  function install(text: string) {
    document.body.innerHTML = `<div class="root"><span class="value">${text}</span></div>`;
  }
  const read = (root: Element) => root.querySelector('.value')?.textContent?.trim() ?? '';
  const setText = (text: string) => {
    (document.querySelector('.value') as HTMLElement).textContent = text;
  };

  it('reports a change to the text', async () => {
    vi.useFakeTimers();
    install('one');
    const onChange = vi.fn();

    const dispose = watchText('.root', read, onChange, { debounceMs: 100 });
    setText('two');
    await vi.advanceTimersByTimeAsync(1);
    await vi.advanceTimersByTimeAsync(200);

    expect(onChange).toHaveBeenCalledTimes(1);
    dispose();
  });

  it('stays quiet when the text is rewritten with the same value', async () => {
    vi.useFakeTimers();
    install('one');
    const onChange = vi.fn();

    const dispose = watchText('.root', read, onChange, { debounceMs: 100 });
    setText('one');
    await vi.advanceTimersByTimeAsync(1);
    await vi.advanceTimersByTimeAsync(200);

    expect(onChange).not.toHaveBeenCalled();
    dispose();
  });

  it('stops reporting once disposed', async () => {
    vi.useFakeTimers();
    install('one');
    const onChange = vi.fn();

    const dispose = watchText('.root', read, onChange, { debounceMs: 100 });
    dispose();
    setText('two');
    await vi.advanceTimersByTimeAsync(1);
    await vi.advanceTimersByTimeAsync(200);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('does nothing when the root is not on the page', async () => {
    vi.useFakeTimers();
    const onChange = vi.fn();

    const dispose = watchText('.missing', read, onChange, { debounceMs: 100 });
    await vi.advanceTimersByTimeAsync(200);

    expect(onChange).not.toHaveBeenCalled();
    dispose();
  });
});
