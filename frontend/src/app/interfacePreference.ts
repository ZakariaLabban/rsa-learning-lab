export type LabInterface = 'workshop' | 'legacy';

export function preferredInterface(): LabInterface {
  try {
    return localStorage.getItem('rsa-lab-interface') === 'legacy' ? 'legacy' : 'workshop';
  } catch {
    return 'workshop';
  }
}

export function rememberInterface(value: LabInterface) {
  try {
    localStorage.setItem('rsa-lab-interface', value);
  } catch {
    // Explicit routes and the interface switch also work without browser storage.
  }
}
