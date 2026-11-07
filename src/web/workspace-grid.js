import { esc } from './ui.js';
import { tokens } from './aka-kit/tokens.js';

const saved = new Map();
const localize = {
  filterOoo: 'סינון…', equals: 'שווה', notEqual: 'שונה', contains: 'מכיל', notContains: 'אינו מכיל', startsWith: 'מתחיל ב־', endsWith: 'מסתיים ב־', blank: 'ריק', notBlank: 'אינו ריק', lessThan: 'קטן מ־', greaterThan: 'גדול מ־', lessThanOrEqual: 'קטן או שווה', greaterThanOrEqual: 'גדול או שווה', inRange: 'בין', inRangeStart: 'מ־', inRangeEnd: 'עד', andCondition: 'וגם', orCondition: 'או', applyFilter: 'החלה', resetFilter: 'איפוס', clearFilter: 'ניקוי', cancelFilter: 'ביטול', noRowsToShow: 'אין רשומות בסינון הזה', loadingOoo: 'טוען רשומות…', pinColumn: 'קיבוע עמודה', pinLeft: 'קיבוע לשמאל', pinRight: 'קיבוע לימין', noPin: 'ביטול קיבוע', autosizeThisColumn: 'רוחב לפי תוכן', autosizeAllColumns: 'התאמת כל העמודות', resetColumns: 'איפוס עמודות', sortAscending: 'מיון עולה', sortDescending: 'מיון יורד', sortUnSort: 'ביטול מיון', ariaColumnFilterButton: 'סינון עמודה', ariaColumnMenuButton: 'פעולות עמודה', ariaRow: 'שורה', ariaColumn: 'עמודה', ariaVisible: 'גלוי', ariaHidden: 'מוסתר', ariaFilterInput: 'סינון', ariaSearch: 'חיפוש', ariaSelectAllRows: 'בחירת כל השורות', ariaRowSelect: 'בחירת שורה', page: 'עמוד', to: 'עד', of: 'מתוך', more: 'עוד', selectAll: 'בחירת הכל', searchOoo: 'חיפוש…', true: 'כן', false: 'לא',
};

export function mountWorkspaceGrid(element, { kind, rows, columns, selectedId, openRecord, quickFilter = '', compact = false }) {
  const ag = window.agGrid;
  if (!ag?.createGrid) {
    element.innerHTML = '<p class="grid-unavailable" role="alert">לא ניתן לטעון את הטבלה. רעננו את העמוד כדי לנסות שוב.</p>';
    return { destroy() {}, search() {}, reset() {} };
  }
  const c = tokens.colors;
  const stateKey = `${kind}-${compact ? 'compact' : 'desktop'}`;
  const theme = ag.themeQuartz.withParams({
    accentColor: c.accent.main, backgroundColor: c.surface.card, foregroundColor: c.text.primary, borderColor: c.border.default, chromeBackgroundColor: c.surface.subtle, headerBackgroundColor: c.surface.subtle, headerTextColor: c.text.tableHeader, secondaryTextColor: c.text.muted, fontFamily: '"Heebo", "Assistant", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif', fontSize: 12, headerFontSize: 11, headerFontWeight: 500, spacing: 5, rowHeight: compact ? 60 : 40, headerHeight: 35, wrapperBorder: false, wrapperBorderRadius: 0, cellHorizontalPadding: 12, rowBorder: true, columnBorder: false, headerColumnBorder: false, headerColumnResizeHandleColor: c.border.strong, rowHoverColor: c.surface.hover, selectedRowBackgroundColor: c.surface.active, inputFocusBorder: c.accent.main, inputBorder: c.border.strong, inputBackgroundColor: c.surface.card,
  });
  const api = ag.createGrid(element, {
    theme,
    rowData: rows,
    columnDefs: columns,
    defaultColDef: { sortable: true, filter: 'agTextColumnFilter', resizable: true, minWidth: 100, suppressHeaderMenuButton: false },
    enableRtl: true,
    localeText: localize,
    initialState: saved.get(stateKey),
    getRowId: params => params.data.id,
    getRowClass: params => params.data.id === selectedId ? 'workspace-grid-selected' : '',
    domLayout: 'autoHeight',
    animateRows: false,
    suppressMovableColumns: false,
    ensureDomOrder: true,
    enableCellTextSelection: true,
    quickFilterText: quickFilter,
    onRowClicked: event => {
      if (event.data?.recordId && !event.event?.target?.closest('button, a, input')) openRecord(event.data.recordId);
    },
    onCellKeyDown: event => {
      if (event.event?.key === 'Enter' && event.data?.recordId && !event.event.target?.closest('button, a, input')) openRecord(event.data.recordId);
    },
    onGridReady: event => event.api.setGridAriaProperty('label', kind === 'settlement' ? 'חיובי פינוי: מיון וסינון לפי עמודה' : kind === 'requests' ? 'פניות שירות ויישובים קשורים' : 'הרשאות לפי תפקיד'),
  });
  return {
    search(value) { api.setGridOption('quickFilterText', value); },
    reset() { api.resetColumnState(); api.setFilterModel(null); api.setGridOption('quickFilterText', ''); saved.delete(stateKey); },
    destroy() { if (!api.isDestroyed()) { saved.set(stateKey, api.getState()); api.destroy(); } },
  };
}

export function gridRecordButton(id, text) {
  return `<button type="button" class="grid-record-link" data-open="${esc(id)}">${esc(text)}</button>`;
}
