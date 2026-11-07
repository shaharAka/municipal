// In the browser build the trip schema check is skipped: the engine's own rules still apply.
export const loadPacks = () => [];
export const composeBaseline = (_packs?: unknown) => ({});
export const pageProblems = (_ontology?: unknown, _page?: unknown) => [] as string[];
