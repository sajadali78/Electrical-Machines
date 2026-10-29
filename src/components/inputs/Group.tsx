import type { ReactNode } from 'react';

export function Group({ title, children, open = true, badge }: { title: string; children: ReactNode; open?: boolean; badge?: ReactNode }) {
  return (
    <details className="group" open={open}>
      <summary>
        {title}
        {badge}
      </summary>
      <div className="group-body">{children}</div>
    </details>
  );
}
