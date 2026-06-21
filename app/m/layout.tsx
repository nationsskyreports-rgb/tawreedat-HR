// Mobile layout — service worker is registered in root layout (app/layout.tsx)
// This layout just provides the fixed full-screen container for mobile pages.
export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-background flex flex-col overflow-hidden">
      {children}
    </div>
  )
}
