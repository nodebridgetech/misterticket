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
    { path: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
    { path: "/admin/produtores", label: "Produtores", icon: Users, end: false },
    { path: "/admin/eventos", label: "Eventos", icon: Calendar, end: false },
    { path: "/admin/categorias", label: "Categorias", icon: Tag, end: false },
    { path: "/admin/taxas", label: "Taxas", icon: DollarSign, end: false },
  ];

  // Menu items for producers
  const producerMenuItems = [
    { path: "/painel", label: "Dashboard", icon: LayoutDashboard, end: true },
    { path: "/meus-eventos", label: "Meus Eventos", icon: Calendar, end: false },
    { path: "/validar-ingressos", label: "Validar Ingressos", icon: ScanLine, end: false },
    { path: "/instalar", label: "Instalar App", icon: Smartphone, end: false },
  ];

  const menuItems = userRole === "admin" ? adminMenuItems : producerMenuItems;

  return (
    <Sidebar className="border-r border-border bg-background">
      <SidebarHeader className="border-b border-border p-4">
        <Link to="/" className="flex items-center justify-center w-full">
          <img src={logo} alt="Mister Ticket" className="h-12" />
        </Link>
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
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{item.label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              
              {/* Divider */}
              <div className="my-2 border-t border-border" />
              
              {/* Theme Toggle */}
              <SidebarMenuItem>
                <div className="flex items-center justify-between px-2 py-2">
                  <span className="text-sm text-muted-foreground">Tema</span>
                  <ThemeToggle />
                </div>
              </SidebarMenuItem>
              
              {/* Minha Conta */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink 
                    to="/minha-conta"
                    className="flex items-center gap-2 hover:bg-accent"
                    activeClassName="bg-accent text-accent-foreground font-medium"
                  >
                    <User className="h-4 w-4 shrink-0" />
                    <span>Minha Conta</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

    </Sidebar>
  );
};
