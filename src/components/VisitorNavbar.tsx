import { useState } from "react";
import { Search, User, Smartphone } from "lucide-react";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "./ThemeToggle";

export const VisitorNavbar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/eventos?search=${encodeURIComponent(searchTerm.trim())}`);
    } else {
      navigate("/eventos");
    }
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between gap-2 md:gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src={logo} alt="Mister Ticket" className="h-6 md:h-8" />
          </Link>

          {/* Search - Hidden on mobile */}
          <div className="hidden sm:flex flex-1 max-w-md">
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
          </div>

          {/* Navigation Links - Hidden on mobile */}
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/eventos" className="text-foreground hover:text-primary transition-colors">
              Eventos
            </Link>
            <Link to="/instalar" className="text-foreground hover:text-primary transition-colors flex items-center gap-1">
              <Smartphone className="h-4 w-4" />
              Instalar App
            </Link>
          </nav>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            
            {user ? (
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate("/minha-conta")}
                className="shrink-0"
              >
                <User className="h-5 w-5" />
              </Button>
            ) : (
              <Button 
                variant="ghost" 
                onClick={() => navigate("/auth")}
                className="shrink-0 text-sm md:text-base"
              >
                Entrar
              </Button>
            )}
          </div>
        </div>

        {/* Mobile Search - Visible only on small screens */}
        <div className="sm:hidden pb-3">
          <form onSubmit={handleSearch} className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar eventos..."
              className="pl-10 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </form>
        </div>
      </div>
    </nav>
  );
};
