import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { VisitorNavbar } from "./VisitorNavbar";

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  const { userRole } = useAuth();

  // Produtores e admins veem sidebar vertical
  const shouldShowSidebar = userRole === "producer" || userRole === "admin";

  if (shouldShowSidebar) {
    return (
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <SidebarInset className="flex-1">
            <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background px-4">
              <SidebarTrigger />
              <h1 className="text-lg font-semibold">Menu</h1>
            </header>
            <main className="flex-1 overflow-auto">
              {children}
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    );
  }

  // Visitantes (logados ou não) veem navbar horizontal
  return (
    <div className="min-h-screen flex flex-col w-full">
      <VisitorNavbar />
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
};
