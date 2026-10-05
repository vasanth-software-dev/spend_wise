import { AllCommunityModule, ModuleRegistry, colorSchemeDark, themeQuartz } from 'ag-grid-community';

// Register all community modules once
ModuleRegistry.registerModules([AllCommunityModule]);

export const spendwiseLightTheme = themeQuartz.withParams({
  fontFamily: '"Plus Jakarta Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  accentColor: '#10b981',
  backgroundColor: '#ffffff',
  borderColor: '#f1f5f9',
  borderRadius: 12,
  wrapperBorderRadius: 12,
  wrapperBorder: false,
  headerHeight: 46,
  rowHeight: 64,
  cellHorizontalPadding: 16,
  browserColorScheme: 'light',
  chromeBackgroundColor: '#f8fafc',
  fontSize: 13,
  foregroundColor: '#0f172a',
  headerBackgroundColor: '#f8fafc',
  headerFontSize: 11,
  headerFontWeight: 700,
  headerTextColor: '#64748b',
  rowHoverColor: '#f8fafc',
  selectedRowBackgroundColor: 'rgba(16, 185, 129, 0.08)',
  oddRowBackgroundColor: 'transparent',
  rowBorder: {
    color: '#f1f5f9',
    width: 1,
    style: 'solid',
  },
  columnBorder: false,
});

export const spendwiseDarkTheme = themeQuartz.withPart(colorSchemeDark).withParams({
  fontFamily: '"Plus Jakarta Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  accentColor: '#10b981',
  backgroundColor: '#0f172a',
  borderColor: 'rgba(51, 65, 85, 0.6)',
  borderRadius: 12,
  wrapperBorderRadius: 12,
  wrapperBorder: false,
  headerHeight: 46,
  rowHeight: 64,
  cellHorizontalPadding: 16,
  browserColorScheme: 'dark',
  chromeBackgroundColor: '#1e293b',
  fontSize: 13,
  foregroundColor: '#f8fafc',
  headerBackgroundColor: '#0b1120',
  headerFontSize: 11,
  headerFontWeight: 700,
  headerTextColor: '#94a3b8',
  rowHoverColor: 'rgba(30, 41, 59, 0.5)',
  selectedRowBackgroundColor: 'rgba(16, 185, 129, 0.15)',
  oddRowBackgroundColor: 'transparent',
  rowBorder: {
    color: 'rgba(51, 65, 85, 0.6)',
    width: 1,
    style: 'solid',
  },
  columnBorder: false,
});
