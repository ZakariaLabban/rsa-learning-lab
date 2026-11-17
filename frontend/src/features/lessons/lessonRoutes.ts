import { routes } from '../../app/routes';
export const modernPath = (path: string) => `/playground${path}`;
export const lessonRoutes = [
  ...routes,
  { path: '/files', label: 'File exchange', group: 'Tools', issue: 17 },
] as const;
