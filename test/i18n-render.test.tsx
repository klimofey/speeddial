import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/preact';
import { NewTab } from '../src/components/NewTab';
import { setLang } from '../src/lib/i18n';
import * as storage from '../src/lib/storage';
import { DEFAULT_SETTINGS } from '../src/lib/defaults';

vi.mock('sortablejs', () => ({ default: { create: vi.fn(() => ({ destroy: vi.fn() })) } }));
afterEach(() => setLang('en'));

describe('localized render', () => {
  it('renders the add button in Russian when language is ru', async () => {
    await storage.setSettings({ ...DEFAULT_SETTINGS, language: 'ru' });
    render(<NewTab />);
    await waitFor(() => expect(screen.getByLabelText('+ Добавить')).toBeTruthy());
  });
});
