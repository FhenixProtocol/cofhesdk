import { style } from '@vanilla-extract/css';
import { recipe } from '@vanilla-extract/recipes';

const buttonTransition =
    'background-color var(--cofhe-transition-duration-fast) ease-in-out, color var(--cofhe-transition-duration-fast) ease-in-out, border-color var(--cofhe-transition-duration-fast) ease-in-out';

export const button = recipe({
    base: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 500,
        borderStyle: 'solid',
        borderWidth: 1,
        transition: buttonTransition,
        selectors: {
            '&:focus': {
                outline: 'none',
            },
            '&:disabled': {
                opacity: 0.5,
                cursor: 'not-allowed',
            },
        },
    },
    variants: {
        vertical: {
            true: {
                flexDirection: 'column',
            },
            false: {},
        },
        size: {
            sm: {
                padding: '0.25rem 0.5rem',
                fontSize: '0.75rem',
                lineHeight: '1rem',
                gap: '0.375rem',
            },
            md: {
                padding: '0.375rem 0.75rem',
                fontSize: '0.75rem',
                lineHeight: '1rem',
                gap: '0.375rem',
            },
            lg: {
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                lineHeight: '1.25rem',
                gap: '0.5rem',
            },
        },
        variant: {
            primary: {
                backgroundColor: '#80E6E6',
                color: '#003366',
                borderColor: '#666666',
                selectors: {
                    '&:hover': {
                        backgroundColor: '#6DD5D5',
                    },
                    '.dark &': {
                        backgroundColor: '#2E9D9D',
                        color: '#ffffff',
                        borderColor: '#858585',
                    },
                    '.dark &:hover': {
                        backgroundColor: '#268585',
                    },
                },
            },
            default: {
                backgroundColor: 'var(--cofhe-button-bg)',
                color: 'var(--cofhe-button-default-text)',
                borderColor: 'var(--cofhe-button-default-border)',
                selectors: {
                    '&:hover': {
                        backgroundColor: 'var(--cofhe-button-hover-bg)',
                        borderColor: '#4A4A4A',
                    },
                    '.dark &:hover': {
                        borderColor: '#9E9E9E',
                    },
                },
            },
            error: {
                backgroundColor: '#FFB399',
                color: '#003366',
                borderColor: '#666666',
                selectors: {
                    '&:hover': {
                        backgroundColor: '#FF9F80',
                    },
                    '.dark &': {
                        backgroundColor: '#D9532E',
                        color: '#ffffff',
                        borderColor: '#858585',
                    },
                    '.dark &:hover': {
                        backgroundColor: '#C0441F',
                    },
                },
            },
            warning: {
                backgroundColor: '#FFD699',
                color: '#003366',
                borderColor: '#666666',
                selectors: {
                    '&:hover': {
                        backgroundColor: '#FFC966',
                    },
                    '.dark &': {
                        backgroundColor: '#E67E22',
                        color: '#ffffff',
                        borderColor: '#858585',
                    },
                    '.dark &:hover': {
                        backgroundColor: '#D35400',
                    },
                },
            },
            ghost: {
                backgroundColor: 'transparent',
                color: '#003366',
                borderColor: 'transparent',
                selectors: {
                    '&:hover': {
                        backgroundColor: '#f3f4f6',
                    },
                    '.dark &': {
                        color: '#ffffff',
                    },
                    '.dark &:hover': {
                        backgroundColor: '#374151',
                    },
                },
            },
            outline: {
                backgroundColor: 'var(--cofhe-button-bg)',
                color: 'var(--cofhe-button-default-text)',
                borderColor: 'var(--cofhe-button-default-border)',
                selectors: {
                    '&:hover': {
                        backgroundColor: '#f9fafb',
                        borderColor: '#4A4A4A',
                    },
                    '.dark &:hover': {
                        backgroundColor: '#4A4A4A',
                        borderColor: '#9E9E9E',
                    },
                },
            },
        },
    },
    compoundVariants: [
        {
            variants: {
                vertical: true,
                size: 'sm',
            },
            style: {
                gap: '0.25rem',
            },
        },
        {
            variants: {
                vertical: true,
                size: 'md',
            },
            style: {
                gap: '0.25rem',
            },
        },
        {
            variants: {
                vertical: true,
                size: 'lg',
            },
            style: {
                gap: '0.375rem',
            },
        },
    ],
    defaultVariants: {
        size: 'md',
        variant: 'default',
        vertical: false,
    },
});

export const iconWrapper = style({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
});