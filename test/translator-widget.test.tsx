import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import { TranslatorRender, TranslatorConfigEditor } from '../src/components/widgets/TranslatorWidget';

const g = globalThis as unknown as { Translator?: unknown; LanguageDetector?: unknown };

beforeEach(() => {
  g.LanguageDetector = { async availability() { return 'available'; },
    async create() { return { async detect() { return [{ detectedLanguage: 'ru', confidence: 1 }]; } }; } };
  g.Translator = { async availability() { return 'available'; },
    async create() { return { async translate(t: string) { return `EN:${t}`; } }; } };
});
afterEach(() => { g.Translator = undefined; g.LanguageDetector = undefined; vi.useRealTimers(); });

describe('TranslatorRender', () => {
  it('translates debounced input on-device', async () => {
    render(<TranslatorRender config={{ target: 'en', cloudFallback: false }} />);
    fireEvent.input(screen.getByPlaceholderText('Enter text…'), { target: { value: 'привет' } });
    await waitFor(() => expect(screen.getByText('EN:привет')).toBeTruthy(), { timeout: 2000 });
  });
});

describe('TranslatorConfigEditor', () => {
  it('emits target language changes', () => {
    const onChange = vi.fn();
    render(<TranslatorConfigEditor config={{ target: 'en', cloudFallback: false }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Translate to'), { target: { value: 'fr' } });
    expect(onChange).toHaveBeenCalledWith({ target: 'fr', cloudFallback: false });
  });

  it('requests permission when enabling cloud fallback', async () => {
    const onChange = vi.fn();
    render(<TranslatorConfigEditor config={{ target: 'en', cloudFallback: false }} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Allow cloud translation'));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ target: 'en', cloudFallback: true }));
  });
});
