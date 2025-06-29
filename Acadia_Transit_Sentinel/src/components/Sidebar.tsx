import { ReactNode } from 'react';
import { X } from 'lucide-react';

interface SidebarProps {
  children: ReactNode;
  isOpen: boolean;
}

export function Sidebar({ children, isOpen }: SidebarProps) {
  return (
    <div 
      className={`
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
        fixed inset-y-0 left-0 z-40 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0
      `}
    >
      <div className="h-full flex flex-col overflow-y-auto">
        <div className="h-16 flex items-center justify-between md:hidden px-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Menu</h2>
          <button
            type="button"
            className="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <span className="sr-only">Close sidebar</span>
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}