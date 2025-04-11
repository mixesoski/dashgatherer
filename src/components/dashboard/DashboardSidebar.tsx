
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  BarChart2, 
  Activity, 
  Calendar, 
  Users, 
  Settings, 
  ChevronRight,
  LayoutDashboard,
  CreditCard,
  HelpCircle
} from 'lucide-react';
import { Button } from "@/components/ui/button";

interface DashboardSidebarProps {
  userRole?: string | null;
  userEmail?: string | null;
}

export function DashboardSidebar({ userRole, userEmail }: DashboardSidebarProps) {
  const location = useLocation();
  
  const navigation = [
    { 
      name: 'Dashboard', 
      href: '/dashboard', 
      icon: LayoutDashboard, 
      current: location.pathname === '/dashboard' 
    },
    { 
      name: 'Analytics', 
      href: '/dashboard', 
      icon: BarChart2, 
      current: false 
    },
    { 
      name: 'Training', 
      href: '/dashboard', 
      icon: Activity, 
      current: false 
    },
    { 
      name: 'Calendar', 
      href: '/dashboard', 
      icon: Calendar, 
      current: false 
    },
  ];
  
  const secondaryNavigation = [
    { 
      name: 'Account', 
      href: '/account', 
      icon: Settings, 
      current: location.pathname === '/account' 
    },
    { 
      name: 'Subscription', 
      href: '/subscription', 
      icon: CreditCard, 
      current: location.pathname === '/subscription' 
    },
  ];
  
  if (userRole === 'coach') {
    navigation.push({ 
      name: 'Athletes', 
      href: '/dashboard', 
      icon: Users, 
      current: false 
    });
  }

  return (
    <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
      <div className="flex flex-col flex-grow border-r border-gray-200 bg-white overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-5">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <div className="h-10 w-10 rounded bg-gray-100 flex items-center justify-center">
                <svg className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                </svg>
              </div>
            </div>
            <div className="ml-3">
              <div className="text-sm font-medium text-gray-700 truncate">{userEmail || 'User'}</div>
              <div className="text-xs text-gray-500">
                {userRole === 'coach' ? 'Coach' : 'Athlete'}
              </div>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </div>
        
        <div className="mt-1 px-3">
          <Button variant="default" className="w-full bg-blue-600 hover:bg-blue-700 text-white justify-center" asChild>
            <Link to="/subscription">
              Upgrade to Premium
            </Link>
          </Button>
        </div>
        
        <div className="mt-5 flex-grow flex flex-col">
          <nav className="flex-1 px-2 space-y-6">
            <div className="space-y-1">
              <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                GET STARTED
              </h3>
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    item.current
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                    'group flex items-center px-3 py-2 text-sm font-medium rounded-md'
                  )}
                  aria-current={item.current ? 'page' : undefined}
                >
                  <item.icon
                    className={cn(
                      item.current ? 'text-gray-600' : 'text-gray-400 group-hover:text-gray-500',
                      'mr-3 flex-shrink-0 h-5 w-5'
                    )}
                    aria-hidden="true"
                  />
                  {item.name}
                </Link>
              ))}
            </div>
            
            <div className="space-y-1">
              <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                ACCOUNT
              </h3>
              {secondaryNavigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    item.current
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                    'group flex items-center px-3 py-2 text-sm font-medium rounded-md'
                  )}
                >
                  <item.icon
                    className={cn(
                      item.current ? 'text-gray-600' : 'text-gray-400 group-hover:text-gray-500',
                      'mr-3 flex-shrink-0 h-5 w-5'
                    )}
                    aria-hidden="true"
                  />
                  {item.name}
                </Link>
              ))}
            </div>
          </nav>
        </div>
        
        <div className="px-3 py-4 border-t border-gray-200">
          <div className="flex items-center">
            <HelpCircle className="h-5 w-5 text-gray-400" />
            <Link to="#" className="ml-2 text-sm font-medium text-gray-600 hover:text-gray-900">
              Help & Support
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
