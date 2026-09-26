import React, { createContext, useState, useEffect, useContext } from 'react';

export const SidebarContext = createContext();

export const SidebarProvider = ({ children }) => {
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(() => {
    return localStorage.getItem('hyperbrain_sidebar_desktop') !== 'closed';
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const toggleDesktopSidebar = () => {
    setDesktopSidebarOpen(prev => {
      const next = !prev;
      localStorage.setItem('hyperbrain_sidebar_desktop', next ? 'open' : 'closed');
      return next;
    });
  };

  const toggleMobileSidebar = () => {
    setMobileSidebarOpen(prev => !prev);
  };

  return (
    <SidebarContext.Provider
      value={{
        desktopSidebarOpen,
        mobileSidebarOpen,
        setDesktopSidebarOpen,
        setMobileSidebarOpen,
        toggleDesktopSidebar,
        toggleMobileSidebar
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};
