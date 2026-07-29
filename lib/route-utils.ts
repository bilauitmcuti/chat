// Utility functions for route-to-program mapping

export type ProgramValue = 
  | 'Foundation/Professional' 
  | 'All' 
  | 'PreDiploma' 
  | 'Diploma' 
  | 'DiplomaPartTime' 
  | 'Bachelor' 
  | 'BachelorPartTime' 
  | 'Master' 
  | 'PhD';

const PROGRAM_VALUE_SET = new Set<string>([
  'Foundation/Professional',
  'All',
  'PreDiploma',
  'Diploma',
  'DiplomaPartTime',
  'Bachelor',
  'BachelorPartTime',
  'Master',
  'PhD',
]);

export function isProgramValue(value: string): value is ProgramValue {
  return PROGRAM_VALUE_SET.has(value);
}

/** Dropdown label before API `programOptions` hydrates (avoids wrong Foundation fallback). */
const PROGRAM_VALUE_LABELS: Record<ProgramValue, string> = {
  All: 'All',
  'Foundation/Professional': 'Foundation/Professional',
  PreDiploma: 'Pre-Diploma',
  Diploma: 'Diploma',
  DiplomaPartTime: 'Diploma (Part-Time)',
  Bachelor: 'Bachelor',
  BachelorPartTime: 'Bachelor (Part-Time)',
  Master: 'Master',
  PhD: 'PhD',
};

export function getLabelForProgramValue(program: ProgramValue): string {
  return PROGRAM_VALUE_LABELS[program] ?? program;
}

/**
 * Prefer pathname when it encodes a program; otherwise use RSC `programFromRoute` slug
 * (fixes refresh when `usePathname()` lags behind the real URL on first paint).
 */
export function resolveProgramFromPathAndProps(
  pathname: string | null | undefined,
  programFromRoute: string
): ProgramValue {
  const segments = pathname?.split('/').filter(Boolean) ?? [];
  const pathSeg = segments[0] && segments[0] !== 'list' ? segments[0] : null;
  const fromPath = pathSeg ? getProgramFromRoute(pathSeg) : 'All';
  if (fromPath !== 'All') return fromPath;
  if (programFromRoute && programFromRoute !== 'All') {
    const fromProps = getProgramFromRoute(programFromRoute);
    if (fromProps !== 'All') return fromProps;
  }
  return 'All';
}

// Map route segment to program value
export function getProgramFromRoute(route: string | null | undefined): ProgramValue {
  if (!route) return 'All';
  
  const routeMap: Record<string, ProgramValue> = {
    'foundation-professional': 'Foundation/Professional',
    'pre-diploma': 'PreDiploma',
    'diploma': 'Diploma',
    'diploma-part-time': 'DiplomaPartTime',
    'bachelor': 'Bachelor',
    'bachelor-part-time': 'BachelorPartTime',
    'master': 'Master',
    'phd': 'PhD',
  };
  
  return routeMap[route] || 'All';
}

// Map program value to route segment
export function getRouteFromProgram(program: ProgramValue): string {
  const programMap: Record<ProgramValue, string> = {
    'Foundation/Professional': 'foundation-professional',
    'All': '',
    'PreDiploma': 'pre-diploma',
    'Diploma': 'diploma',
    'DiplomaPartTime': 'diploma-part-time',
    'Bachelor': 'bachelor',
    'BachelorPartTime': 'bachelor-part-time',
    'Master': 'master',
    'PhD': 'phd',
  };
  
  return programMap[program] || '';
}

// Get route path for a program and view mode
export function getRoutePath(program: ProgramValue, viewMode: 'grid' | 'list'): string {
  const routeSegment = getRouteFromProgram(program);
  
  if (program === 'All') {
    // Homepage routes
    return viewMode === 'grid' ? '/' : '/list';
  }
  
  // Program-specific routes
  const basePath = `/${routeSegment}`;
  return viewMode === 'grid' ? basePath : `${basePath}/list`;
}

// Check if route is valid
export function isValidProgramRoute(route: string | null | undefined): boolean {
  if (!route) return true; // Empty route means "All"
  
  const validRoutes = [
    'foundation-professional',
    'pre-diploma',
    'diploma',
    'diploma-part-time',
    'bachelor',
    'bachelor-part-time',
    'master',
    'phd',
  ];
  
  return validRoutes.includes(route);
}

// Get display name for a program route
export function getProgramDisplayName(route: string | null | undefined): string {
  if (!route) return 'All';
  
  const displayNameMap: Record<string, string> = {
    'foundation-professional': 'Foundation/Professional',
    'pre-diploma': 'Pre-Diploma',
    'diploma': 'Diploma',
    'diploma-part-time': 'Diploma (Part-Time)',
    'bachelor': 'Bachelor',
    'bachelor-part-time': 'Bachelor (Part-Time)',
    'master': 'Master',
    'phd': 'PhD',
  };
  
  return displayNameMap[route] || 'All';
}
