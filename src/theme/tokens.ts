import { createTheme } from '@mui/material/styles';

/*
 * Generic demo theme tokens. Components should read these through the MUI theme rather than
 * defining colors and sizes locally.
 */

/** System neutrals, light to dark. */
export const neutral = {
  0: '#FFFFFF',
  50: '#FDFDFD',
  100: '#F7F7F7',
  200: '#E0E0E0',
  300: '#C6C6C6',
  400: '#AAA9A8',
  500: '#7F7F7F',
  800: '#2C2C2C',
  900: '#000000',
} as const;

/** System blue-greys, light to dark. */
export const blueGrey = {
  50: '#ECEFF1',
  100: '#CFD8DC',
  200: '#B0BEC5',
  300: '#90A4AE',
  400: '#78909C',
  500: '#607D8B',
  600: '#546E7A',
  700: '#455A64',
} as const;

/** Generic blue primary-action color. It is NOT the error color. */
export const brand = {
  main: '#1769AA',
  dark: '#0F4C81',
  light: '#4B9FE1',
  contrastText: neutral[0],
} as const;

/** Semantic blue and green. */
export const info = {
  light: '#4A90E2',
  main: '#1565C0',
  dark: '#0D47A1',
  contrastText: neutral[0],
} as const;

export const success = {
  light: '#66BB6A',
  main: '#2E7D32',
  dark: '#1B5E20',
  contrastText: neutral[0],
} as const;

/*
 * Error and warning colors use the MUI defaults. Status and validation never rely on color alone:
 * an icon and text always accompany them.
 */
const muiDefaults = createTheme().palette;
export const provisionalSemantic = {
  // The MUI default red (#d32f2f) is 4.31:1 on the page background, below the 4.5:1 AA minimum for normal text.
  // This red is 4.87:1 on the page background and 5.62:1 on white.
  error: {
    light: muiDefaults.error.light,
    main: '#C62828',
    dark: '#B71C1C',
    contrastText: muiDefaults.error.contrastText,
  },
  warning: {
    light: muiDefaults.warning.light,
    main: muiDefaults.warning.main,
    dark: muiDefaults.warning.dark,
    contrastText: muiDefaults.warning.contrastText,
  },
} as const;

export const text = {
  primary: neutral[800],
  secondary: blueGrey[600], // 5.0:1 on white
  disabled: neutral[400],
} as const;

export const surface = {
  page: blueGrey[50],
  paper: neutral[0],
  subtle: neutral[100],
  tableHeader: blueGrey[100],
  header: neutral[900],
} as const;

export const border = {
  divider: neutral[200],
  /** Form control outline; neutral[500] meets the 3:1 non-text contrast minimum on white. */
  control: neutral[500],
  controlHover: neutral[800],
  strong: blueGrey[300],
} as const;

/** Focus indicator: 2px blue ring. Blue is used so focus never reads as brand red or error. */
export const focus = {
  ring: info.main,
  ringOnDark: info.light,
  width: 2,
  offset: 2,
} as const;

export const typography = {
  display: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  body: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
} as const;

/** Sizes in px. `default` is the standard control height; `compact` suits dense tables and toolbars. */
export const sizing = {
  controlHeight: { default: 40, compact: 32 },
  radius: { control: 4, surface: 4, dialog: 8 },
  headerHeight: 56,
  contentMaxWidth: 1600,
  tableCellPadding: '8px 12px',
} as const;

/**
 * Touch-sized controls. On narrow screens and coarse pointers (a finger) interactive controls reach about 44px;
 * a wide, mouse-driven layout keeps its density. `query` matches the app's narrow breakpoint (MUI `md`).
 */
export const touch = {
  minTarget: 44,
  query: '@media (max-width: 899.95px), (pointer: coarse)',
} as const;

/** A link that stands on its own line (not inside a sentence), so it can have a touch-sized hit area. */
export const standaloneLinkSx = {
  display: 'inline-flex',
  alignItems: 'center',
  [touch.query]: { minHeight: touch.minTarget },
} as const;
