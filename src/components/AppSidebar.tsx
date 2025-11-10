import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavLink } from "./NavLink";

export const AppSidebar = () => {
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const { open } = useSidebar();
  const [searchTerm, setSearchTerm] = useState("");
  
  const dashboardPath = userRole === "admin" ? "/admin" : "/painel";

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/eventos?search=${encodeURIComponent(searchTerm.trim())}`);
    } else {
      navigate("/eventos");
    }
  };

  return (
    <Sidebar className="border-r border-border">
      <SidebarHeader className="border-b border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <Link to="/" className="flex items-center justify-center w-full">
            <img src={logo} alt="Mister Ticket" className="h-12" />
          </Link>
          <SidebarTrigger className="shrink-0" />
        </div>
        
        <form onSubmit={handleSearch} className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar eventos..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </form>
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
                    {open && <span>Dashboard</span>}
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
                    {open && <span>Todos Eventos</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-4 space-y-2">
        <div className="flex items-center justify-between">
          {open && <span className="text-sm text-muted-foreground">Tema</span>}
          <ThemeToggle />
        </div>
        <Button 
          variant="ghost" 
          className="w-full justify-start"
          asChild
        >
          <Link to="/minha-conta">
            <User className="h-4 w-4 mr-2" />
            {open && <span>Minha Conta</span>}
          </Link>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
};
