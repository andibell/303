import { createTheme } from '@mui/material/styles';
import {
  blueGrey,
  border,
  brand,
  focus,
  info,
  neutral,
  provisionalSemantic,
  sizing,
  success,
  surface,
  text,
  touch,
  typography,
} from './tokens';

const focusOutline = {
  outline: `${focus.width}px solid ${focus.ring}`,
  outlineOffset: focus.offset,
};

export const theme = createTheme({
  spacing: 8,
  shape: { borderRadius: sizing.radius.surface },
  palette: {
    mode: 'light',
    primary: { ...brand },
    secondary: {
      main: blueGrey[600],
      light: blueGrey[300],
      dark: blueGrey[700],
      contrastText: neutral[0],
    },
    info: { ...info },
    success: { ...success },
    error: { ...provisionalSemantic.error },
    warning: { ...provisionalSemantic.warning },
    text: { ...text },
    background: { default: surface.page, paper: surface.paper },
    divider: border.divider,
    action: {
      active: text.secondary,
      hover: blueGrey[50],
      selected: blueGrey[100],
      disabled: text.disabled,
      disabledBackground: neutral[200],
      focus: blueGrey[100],
    },
  },
  typography: {
    fontFamily: typography.body,
    fontSize: 14,
    // Page titles and prominent section titles use the system font stack.
    h1: { fontFamily: typography.display, fontWeight: 500, fontSize: '1.75rem', lineHeight: 1.25 },
    h2: { fontFamily: typography.display, fontWeight: 500, fontSize: '1.375rem', lineHeight: 1.3 },
    // Keep typography consistent across platforms.
    h3: { fontWeight: 600, fontSize: '1.125rem', lineHeight: 1.35 },
    h4: { fontWeight: 600, fontSize: '1rem', lineHeight: 1.4 },
    h5: { fontWeight: 600, fontSize: '0.875rem', lineHeight: 1.4 },
    h6: { fontWeight: 600, fontSize: '0.875rem', lineHeight: 1.4 },
    subtitle1: { fontSize: '1rem', lineHeight: 1.5 },
    subtitle2: { fontWeight: 600, fontSize: '0.875rem', lineHeight: 1.5 },
    body1: { fontSize: '0.875rem', lineHeight: 1.5 },
    body2: { fontSize: '0.8125rem', lineHeight: 1.5 },
    button: { fontWeight: 600, fontSize: '0.875rem', textTransform: 'none' },
    caption: { fontSize: '0.75rem', lineHeight: 1.4 },
    overline: { fontWeight: 600, fontSize: '0.75rem', letterSpacing: '0.06em', lineHeight: 1.4 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: surface.page },
        '*:focus-visible': focusOutline,
        // Inputs show focus on their outline, so suppress the inner element's ring.
        '.MuiInputBase-input:focus-visible': { outline: 'none' },
      },
    },
    MuiButtonBase: {
      styleOverrides: { root: { '&.Mui-focusVisible': focusOutline } },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          minHeight: sizing.controlHeight.default,
          borderRadius: sizing.radius.control,
          paddingInline: 16,
          [touch.query]: { minHeight: touch.minTarget },
        },
        sizeSmall: {
          minHeight: sizing.controlHeight.compact,
          paddingInline: 12,
          [touch.query]: { minHeight: touch.minTarget },
        },
      },
      variants: [
        // Secondary action: a solid outline, so the border meets 3:1 non-text contrast.
        { props: { variant: 'outlined', color: 'secondary' }, style: { borderColor: blueGrey[600] } },
      ],
    },
    MuiIconButton: {
      styleOverrides: {
        root: { borderRadius: sizing.radius.control, [touch.query]: { minWidth: touch.minTarget, minHeight: touch.minTarget } },
      },
    },
    // A radio or checkbox row is the target: the whole label is clickable, so the row reaches 44px.
    MuiFormControlLabel: { styleOverrides: { root: { [touch.query]: { minHeight: touch.minTarget } } } },
    MuiTextField: { defaultProps: { size: 'small', variant: 'outlined' } },
    MuiFormControl: { defaultProps: { size: 'small' } },
    MuiSelect: { defaultProps: { size: 'small' } },
    MuiAutocomplete: {
      defaultProps: { size: 'small' },
      styleOverrides: {
        // The typing area fills the 44px field, so tapping anywhere in it focuses the input.
        root: {
          [touch.query]: {
            '& .MuiOutlinedInput-root.MuiInputBase-sizeSmall': { paddingBlock: 0, '& .MuiAutocomplete-input': { paddingBlock: '12px' } },
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: surface.paper,
          borderRadius: sizing.radius.control,
          fontSize: '0.875rem',
          '& .MuiOutlinedInput-notchedOutline': { borderColor: border.control },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: border.controlHover },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: focus.ring,
            borderWidth: focus.width,
          },
          '&.MuiInputBase-colorWarning .MuiOutlinedInput-notchedOutline': { borderColor: provisionalSemantic.warning.main },
          '&.Mui-error .MuiOutlinedInput-notchedOutline': { borderColor: provisionalSemantic.error.main },
          '&.Mui-disabled': { backgroundColor: neutral[100] },
          '&.Mui-disabled .MuiOutlinedInput-notchedOutline': { borderColor: border.divider },
          [touch.query]: { minHeight: touch.minTarget, '& .MuiOutlinedInput-input:not(.MuiAutocomplete-input)': { paddingBlock: '12px' } },
        },
      },
    },
    MuiFormLabel: {
      styleOverrides: {
        // Required-field marker.
        asterisk: { color: provisionalSemantic.error.main },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        // A focused label follows the focus ring color.
        root: { fontSize: '0.875rem', '&.Mui-focused:not(.Mui-error)': { color: focus.ring } },
      },
    },
    MuiFormHelperText: { styleOverrides: { root: { fontSize: '0.75rem', marginInline: 0 } } },
    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 44, borderBottom: `1px solid ${border.divider}` },
        indicator: { height: 3, backgroundColor: brand.main },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 44,
          fontWeight: 600,
          color: text.secondary,
          '&.Mui-selected': { color: text.primary },
        },
      },
    },
    MuiTable: { defaultProps: { size: 'small' } },
    MuiTableCell: {
      styleOverrides: {
        root: { padding: sizing.tableCellPadding, fontSize: '0.875rem', borderBottomColor: border.divider },
        head: {
          backgroundColor: surface.tableHeader,
          color: text.primary,
          fontWeight: 600,
          borderBottom: `1px solid ${border.strong}`,
        },
      },
    },
    MuiTableRow: {
      styleOverrides: { root: { '&.MuiTableRow-hover:hover': { backgroundColor: blueGrey[50] } } },
    },
    MuiChip: {
      styleOverrides: {
        root: { height: 24, borderRadius: sizing.radius.control, fontWeight: 600, fontSize: '0.75rem' },
      },
    },
    MuiAlert: {
      defaultProps: { variant: 'standard' },
      styleOverrides: { root: { borderRadius: sizing.radius.surface, fontSize: '0.875rem' } },
    },
    MuiLink: { defaultProps: { underline: 'always', color: info.main } },
    MuiTooltip: {
      styleOverrides: { tooltip: { backgroundColor: neutral[800], fontSize: '0.75rem' } },
    },
    MuiDialog: { styleOverrides: { paper: { borderRadius: sizing.radius.dialog } } },
    MuiAppBar: { defaultProps: { elevation: 0 } },
  },
});
