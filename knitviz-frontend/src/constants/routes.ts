export const ROUTE_PATHS = {
  HOME: '/',
  VIZ: '/viz',
} as const;

export type RoutePath = typeof ROUTE_PATHS[keyof typeof ROUTE_PATHS];
