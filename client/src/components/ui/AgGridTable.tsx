import React, { forwardRef, useMemo } from 'react';
import { AgGridReact, AgGridReactProps } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import { useAppSelector } from '../../store/index.js';
import { spendwiseLightTheme, spendwiseDarkTheme } from './AgGridTheme.js';

export interface AgGridTableProps<TData = any> extends AgGridReactProps<TData> {
  height?: number | string;
  className?: string;
  containerClassName?: string;
}

export const defaultTableColDef: ColDef = {
  sortable: true,
  resizable: true,
  suppressMovable: true,
};

export const AgGridTable = forwardRef<AgGridReact, AgGridTableProps>(function AgGridTable(
  {
    height,
    className = '',
    containerClassName = '',
    theme,
    defaultColDef,
    domLayout,
    ...props
  },
  ref
) {
  const isDark = useAppSelector((state) => state.theme.isDark);

  const activeTheme = useMemo(() => {
    if (theme) return theme;
    return isDark ? spendwiseDarkTheme : spendwiseLightTheme;
  }, [theme, isDark]);

  const mergedDefaultColDef = useMemo(
    () => ({
      ...defaultTableColDef,
      ...defaultColDef,
    }),
    [defaultColDef]
  );

  const containerStyle = useMemo<React.CSSProperties>(() => {
    if (domLayout === 'autoHeight') {
      return { width: '100%' };
    }
    const resolvedHeight = height ?? 560;
    return {
      width: '100%',
      height: typeof resolvedHeight === 'number' ? `${resolvedHeight}px` : resolvedHeight,
    };
  }, [height, domLayout]);

  return (
    <div
      className={`w-full overflow-hidden transition-colors ${containerClassName}`}
      style={containerStyle}
    >
      <AgGridReact
        ref={ref}
        theme={activeTheme}
        defaultColDef={mergedDefaultColDef}
        domLayout={domLayout}
        className={`w-full h-full ${className}`}
        {...props}
      />
    </div>
  );
});
