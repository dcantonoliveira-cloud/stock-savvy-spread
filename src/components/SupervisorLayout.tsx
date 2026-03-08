import { ReactNode } from 'react';
import SupervisorSidebar from './SupervisorSidebar';

export default function SupervisorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <SupervisorSidebar />
      <main className="flex-1 ml-[260px] p-8">
        <div className="max-w-[1400px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
