import { Link } from "react-router-dom";
import { Search, LayoutDashboard, Calendar, User } from "lucide-react";
import logo from "@/assets/logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "@/components/ui/sidebar";
import { NavLink } from "./NavLink";

export const AppSidebar = () => {
  const { userRole } = useAuth();
  
  const dashboardPath = userRole === "admin" ? "/admin" : "/painel";

  return (
    <Sidebar className="border-r border-border">
      <SidebarHeader className="border-b border-border p-4">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="Mister Ticket" className="h-8" />
        </Link>
        
        <div className="relative w-full mt-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar eventos..."
            className="pl-10"
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink 
                    to={dashboardPath}
                    className="flex items-center gap-2 hover:bg-accent"
                    activeClassName="bg-accent text-accent-foreground font-medium"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Dashboard</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink 
                    to="/eventos"
                    className="flex items-center gap-2 hover:bg-accent"
                    activeClassName="bg-accent text-accent-foreground font-medium"
                  >
                    <Calendar className="h-4 w-4" />
                    <span>Todos Eventos</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link 
                    to="#contato"
                    className="flex items-center gap-2 hover:bg-accent text-muted-foreground cursor-not-allowed"
                    onClick={(e) => e.preventDefault()}
                  >
                    <span>Contato (em breve)</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Tema</span>
          <ThemeToggle />
        </div>
        <Button 
          variant="ghost" 
          className="w-full justify-start"
          asChild
        >
          <Link to="/minha-conta">
            <User className="h-4 w-4 mr-2" />
            Minha Conta
          </Link>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
};
