/** Route identifiers only; React Router is intentionally not part of the foundation. */
export const PMO_ROUTES = { foundation: "foundation" } as const;

export type PmoRoute = (typeof PMO_ROUTES)[keyof typeof PMO_ROUTES];
