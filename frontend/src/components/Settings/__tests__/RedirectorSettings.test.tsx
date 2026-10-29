import { createTheme, ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RedirectorSettings from '../RedirectorSettings';

vi.mock('../../../contexts/LanguageContext', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}));

const theme = createTheme();

const renderSection = () =>
    render(
        <ThemeProvider theme={theme}>
            <RedirectorSettings />
        </ThemeProvider>
    );

describe('RedirectorSettings', () => {
    it('links the setup guide served by this instance', () => {
        renderSection();

        const guide = screen.getByRole('link', { name: /browserRedirectorOpenGuide/i });
        expect(guide).toHaveAttribute('href', '/from/help');
    });

    it('links the Redirector project for every-browser installs', () => {
        renderSection();

        const project = screen.getByRole('link', { name: /rxliuli\/redirector/ });
        expect(project).toHaveAttribute('href', 'https://github.com/rxliuli/redirector');
        expect(project).toHaveAttribute('target', '_blank');
    });
});
