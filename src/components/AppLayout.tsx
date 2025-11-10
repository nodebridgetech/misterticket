import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { SidebarProvider } from "@/components/ui/sidebar";
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
      <SidebarProvider defaultOpen>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <main className="flex-1 overflow-auto">
            {children}
          </main>
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
