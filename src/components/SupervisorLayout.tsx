import { ReactNode } from 'react';
import SupervisorSidebar from './SupervisorSidebar';

export default function SupervisorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <SupervisorSidebar />
      <main className="flex-1 ml-64 p-8">
        {children}
      </main>
    </div>
  );
}
