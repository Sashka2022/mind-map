import { createContext, useContext } from 'react';

/** True while a node is being rendered inside an offscreen export/preview snapshot. */
export const ExportModeContext = createContext(false);

export function useIsExportMode(): boolean {
  return useContext(ExportModeContext);
}
