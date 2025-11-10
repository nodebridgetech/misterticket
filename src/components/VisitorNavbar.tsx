import { useState } from "react";
import { Search, User, ShoppingCart } from "lucide-react";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "./ThemeToggle";
import { Badge } from "@/components/ui/badge";

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
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src={logo} alt="Mister Ticket" className="h-8" />
          </Link>

          {/* Search */}
          <div className="flex-1 max-w-md">
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

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/eventos" className="text-foreground hover:text-primary transition-colors">
              Eventos
            </Link>
          </nav>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            
            {user ? (
              <>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => navigate("/minha-conta")}
                  className="hidden sm:flex"
                >
                  <User className="h-5 w-5" />
                </Button>
                <Button 
                  variant="default"
                  size="icon"
                  className="relative"
                  onClick={() => {/* Carrinho - implementar depois */}}
                >
                  <ShoppingCart className="h-5 w-5" />
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                  >
                    0
                  </Badge>
                </Button>
              </>
            ) : (
              <>
                <Button 
                  variant="ghost" 
                  onClick={() => navigate("/auth")}
                  className="hidden sm:flex"
                >
                  Entrar
                </Button>
                <Button 
                  variant="default"
                  size="icon"
                  className="relative"
                  onClick={() => {/* Carrinho - implementar depois */}}
                >
                  <ShoppingCart className="h-5 w-5" />
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                  >
                    0
                  </Badge>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
