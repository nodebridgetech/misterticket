import { Link } from "react-router-dom";
import { LayoutDashboard, Users, Calendar, Tag, DollarSign, User, ScanLine, Smartphone } from "lucide-react";
import logo from "@/assets/logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavLink } from "./NavLink";

export const AppSidebar = () => {
  const { userRole } = useAuth();
  const { open } = useSidebar();
  
  const dashboardPath = userRole === "admin" ? "/admin" : "/painel";

  // Menu items for admin
  const adminMenuItems = [
    { path: "/", label: "Página Inicial", icon: LayoutDashboard, end: true },
    { path: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
    { path: "/admin/produtores", label: "Produtores", icon: Users, end: false },
    { path: "/admin/eventos", label: "Eventos", icon: Calendar, end: false },
    { path: "/admin/categorias", label: "Categorias", icon: Tag, end: false },
    { path: "/admin/taxas", label: "Taxas", icon: DollarSign, end: false },
  ];

  // Menu items for producers
  const producerMenuItems = [
    { path: "/", label: "Página Inicial", icon: LayoutDashboard, end: true },
    { path: "/painel", label: "Dashboard", icon: LayoutDashboard, end: true },
    { path: "/meus-eventos", label: "Meus Eventos", icon: Calendar, end: false },
    { path: "/validar-ingressos", label: "Validar Ingressos", icon: ScanLine, end: false },
    { path: "/instalar", label: "Instalar App", icon: Smartphone, end: false },
  ];

  const menuItems = userRole === "admin" ? adminMenuItems : producerMenuItems;

  return (
    <Sidebar className="border-r border-border bg-background" collapsible="icon">
      <SidebarHeader className="border-b border-border p-4">
        <div className="flex items-center justify-between gap-2">
          {open && (
            <Link to="/" className="flex items-center justify-center w-full">
              <img src={logo} alt="Mister Ticket" className="h-12" />
            </Link>
          )}
          <SidebarTrigger className="hidden lg:flex shrink-0" />
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-background">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton asChild>
                      <NavLink 
                        to={item.path}
                        end={item.end}
                        className="flex items-center gap-2 hover:bg-accent"
                        activeClassName="bg-accent text-accent-foreground font-medium"
                        title={item.label}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {open && <span>{item.label}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-4 space-y-2 mt-auto bg-background">
        {open && (
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Tema</span>
            <ThemeToggle />
          </div>
        )}
        {!open && (
          <div className="flex justify-center">
            <ThemeToggle />
          </div>
        )}
        <Button 
          variant="ghost" 
          className={open ? "w-full justify-start" : "w-full justify-center p-2"}
          asChild
          title="Minha Conta"
        >
          <Link to="/minha-conta" className="flex items-center gap-2">
            <User className="h-4 w-4 shrink-0" />
            {open && <span>Minha Conta</span>}
          </Link>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
};
