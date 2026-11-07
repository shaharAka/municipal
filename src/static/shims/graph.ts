// A stable id without node:crypto; only used by the schema check, which the browser build skips.
export const refFor = (type: string, key: string) => `${type}:${key}`;
