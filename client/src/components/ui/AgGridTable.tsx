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
  suppressMovable: false,
  unSortIcon: true,
};

export const AgGridTable = forwardRef(function AgGridTable<TData = any>(
  {
    height,
    className = '',
    containerClassName = '',
    theme,
    defaultColDef,
    domLayout = 'autoHeight',
    ...props
  }: AgGridTableProps<TData>,
  ref: React.ForwardedRef<AgGridReact<TData>>
) {
  const isDark = useAppSelector((state) => state.theme.isDark);

  const activeTheme = useMemo(() => {
    if (theme) return theme;
    return isDark ? spendwiseDarkTheme : spendwiseLightTheme;
  }, [theme, isDark]);

  const mergedDefaultColDef = useMemo<ColDef<TData>>(
    () =>
      ({
        ...defaultTableColDef,
        ...defaultColDef,
      } as ColDef<TData>),
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
      <AgGridReact<TData>
        ref={ref}
        theme={activeTheme}
        defaultColDef={mergedDefaultColDef}
        domLayout={domLayout}
        className={`w-full h-full ${className}`}
        {...props}
      />
    </div>
  );
}) as <TData = any>(
  props: AgGridTableProps<TData> & { ref?: React.Ref<AgGridReact<TData>> }
) => React.ReactElement;
