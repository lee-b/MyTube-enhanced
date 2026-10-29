import { OpenInNew } from '@mui/icons-material';
import { Box, Button, Divider, Link, Typography } from '@mui/material';
import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

/**
 * Settings section for the browser-redirector takeover targets. The setup
 * itself happens in the Redirector extension (outside this app), so this
 * section is documentation-only: it points at the instance-rendered guide,
 * which lists install links for every browser Redirector ships on and the
 * paste-ready rules for this exact origin.
 */
const RedirectorSettings: React.FC = () => {
    const { t } = useLanguage();

    return (
        <Box>
            <Typography variant="h6" sx={{ mb: 1 }}>
                {t('browserRedirector')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('browserRedirectorDescription')}
            </Typography>
            <Button
                variant="outlined"
                startIcon={<OpenInNew />}
                component="a"
                href="/from/help"
                rel="noopener noreferrer"
            >
                {t('browserRedirectorOpenGuide')}
            </Button>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                <Link
                    href="https://github.com/rxliuli/redirector"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    github.com/rxliuli/redirector
                </Link>
            </Typography>
            <Divider sx={{ my: 3 }} />
        </Box>
    );
};

export default RedirectorSettings;
