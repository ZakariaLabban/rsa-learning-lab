import type { ReactNode } from 'react';

export function RolePanels({
  roles,
}: {
  roles: {
    name: 'Alice' | 'Bob' | 'Eve';
    /** Optional heading shown instead of the role name, e.g. "Alice (Sara)". */
    title?: string;
    knowledge: ReactNode;
    action?: ReactNode;
  }[];
}) {
  return (
    <div className="role-panels">
      {roles.map((role) => (
        <section className="role-card" key={role.name}>
          <h3>{role.title ?? role.name}</h3>
          <span className="eyebrow">WHAT {role.name.toUpperCase()} KNOWS</span>
          <div>{role.knowledge}</div>
          {role.action && <p>{role.action}</p>}
        </section>
      ))}
    </div>
  );
}
