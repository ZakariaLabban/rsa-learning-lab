export type LabInterface = 'lecture' | 'workshop' | 'legacy';

export function preferredInterface(): LabInterface {
  try {
    const saved = localStorage.getItem('rsa-lab-interface');
    return saved === 'legacy' || saved === 'workshop' ? saved : 'lecture';
  } catch {
    return 'lecture';
  }
}

export function rememberInterface(value: LabInterface) {
  try {
    localStorage.setItem('rsa-lab-interface', value);
  } catch {
    // Explicit routes and the interface switch also work without browser storage.
  }
}
