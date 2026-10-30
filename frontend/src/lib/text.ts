export const uid = () => Math.random().toString(36).slice(2, 9);
export const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
/** Arabic-Indic digits → Latin digits. */
export const latin = (s: string) => s.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
