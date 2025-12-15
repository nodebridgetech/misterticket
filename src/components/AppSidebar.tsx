import { Link } from "react-router-dom";
import { LayoutDashboard, Users, Calendar, User, ScanLine, FileText, Settings, LinkIcon, Wallet, PieChart, Moon, Sun, Bell } from "lucide-react";
import logo from "@/assets/logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
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

interface Notification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  event_id: string | null;
}

export const AppSidebar = () => {
  const { user, userRole } = useAuth();
  const { open } = useSidebar();
  
  // Theme state
  const [theme, setTheme] = useState<"light" | "dark">("light");
  
  // Notifications state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = savedTheme || (prefersDark ? "dark" : "light");
    setTheme(initialTheme);
    document.documentElement.classList.toggle("dark", initialTheme === "dark");
  }, []);
  
  useEffect(() => {
    if (!user || userRole !== "producer") return;

    fetchNotifications();

    const channel = supabase
      .channel('notifications-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `producer_id=eq.${user.id}`
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          setNotifications(prev => [newNotification, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, userRole]);

  const fetchNotifications = async () => {
    if (!user) return;

    const { data: unreadData } = await supabase
      .from('notifications')
      .select('*')
      .eq('producer_id', user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false });

    const unread = unreadData || [];
    setUnreadCount(unread.length);

    if (unread.length > 0) {
      setNotifications(unread);
    } else {
      const { data: readData } = await supabase
        .from('notifications')
        .select('*')
        .eq('producer_id', user.id)
        .eq('is_read', true)
        .order('created_at', { ascending: false })
        .limit(10);

      setNotifications(readData || []);
    }
  };

  const markAllAsRead = async () => {
    if (!user || unreadCount === 0) return;

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('producer_id', user.id)
      .eq('is_read', false);

    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);

    const { data: readData } = await supabase
      .from('notifications')
      .select('*')
      .eq('producer_id', user.id)
      .eq('is_read', true)
      .order('created_at', { ascending: false })
      .limit(10);

    if (readData) {
      setNotifications(readData);
    }
  };

  const handleNotificationsOpenChange = (open: boolean) => {
    setIsNotificationsOpen(open);
    if (open && unreadCount > 0) {
      markAllAsRead();
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  // Menu items for admin
  const adminMenuItems = [
    { path: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
    { path: "/admin/produtores", label: "Produtores", icon: Users, end: false },
    { path: "/admin/eventos", label: "Eventos", icon: Calendar, end: false },
    { path: "/admin/saques", label: "Saques", icon: Wallet, end: false },
    { path: "/admin/logs", label: "Logs", icon: FileText, end: false },
    { path: "/admin/configuracoes", label: "Configurações", icon: Settings, end: false },
  ];

  // Menu items for producers
  const producerMenuItems = [
    { path: "/painel", label: "Dashboard", icon: LayoutDashboard, end: true },
    { path: "/meus-eventos", label: "Meus Eventos", icon: Calendar, end: false },
    { path: "/links-utm", label: "Links UTM", icon: LinkIcon, end: false },
    { path: "/saques", label: "Saques", icon: Wallet, end: false },
    { path: "/financeiro", label: "Dashboard Financeiro", icon: PieChart, end: false },
    { path: "/validar-ingressos", label: "Validar Ingressos", icon: ScanLine, end: false },
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
                <SidebarMenuButton asChild>
                  <button 
                    onClick={toggleTheme}
                    className="flex items-center gap-2 w-full hover:bg-accent"
                  >
                    {theme === "light" ? (
                      <Moon className="h-4 w-4 shrink-0" />
                    ) : (
                      <Sun className="h-4 w-4 shrink-0" />
                    )}
                    <span>{theme === "light" ? "Modo Escuro" : "Modo Claro"}</span>
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Notifications - Only for producers */}
              {userRole === "producer" && (
                <SidebarMenuItem>
                  <Popover open={isNotificationsOpen} onOpenChange={handleNotificationsOpenChange}>
                    <PopoverTrigger asChild>
                      <SidebarMenuButton asChild>
                        <button className="flex items-center gap-2 w-full hover:bg-accent relative">
                          <Bell className="h-4 w-4 shrink-0" />
                          <span>Notificações</span>
                          {unreadCount > 0 && (
                            <span className="absolute right-2 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-primary-foreground bg-primary rounded-full">
                              {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                          )}
                        </button>
                      </SidebarMenuButton>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="start" side="right">
                      <div className="p-3 border-b border-border">
                        <h4 className="font-semibold text-sm">Notificações</h4>
                      </div>
                      <ScrollArea className="h-[300px]">
                        {notifications.length === 0 ? (
                          <div className="p-4 text-center text-muted-foreground text-sm">
                            Nenhuma notificação
                          </div>
                        ) : (
                          <div className="divide-y divide-border">
                            {notifications.map((notification) => (
                              <div
                                key={notification.id}
                                className={`p-3 ${!notification.is_read ? 'bg-accent/50' : ''}`}
                              >
                                <div className="flex items-start gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium">{notification.title}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                      {notification.message}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                      {formatDistanceToNow(new Date(notification.created_at), {
                                        addSuffix: true,
                                        locale: ptBR
                                      })}
                                    </p>
                                  </div>
                                  {!notification.is_read && (
                                    <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                </SidebarMenuItem>
              )}
              
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
