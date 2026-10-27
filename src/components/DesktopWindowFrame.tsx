import React from 'react';

interface DesktopWindowFrameProps {
  title?: string;
  isDesktopFrame?: boolean;
  children: React.ReactNode;
}

export const DesktopWindowFrame: React.FC<DesktopWindowFrameProps> = ({
  children,
}) => {
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#ecebe5] font-sans">
      {children}
    </div>
  );
};
