import { Search, Ticket, Menu, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <Ticket className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">Mister Ticket</span>
          </Link>

          {/* Desktop Search */}
          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar eventos..."
                className="pl-10"
              />
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-4">
            <Link to="/events" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
              Eventos
            </Link>
            <Link to="/create-event" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
              Criar Evento
            </Link>
            <Button variant="ghost" asChild>
              <Link to="/login">Entrar</Link>
            </Button>
            <Button variant="hero" asChild>
              <Link to="/signup">Cadastrar</Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar eventos..."
                className="pl-10"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Link to="/events" className="text-sm font-medium text-foreground hover:text-primary transition-colors py-2">
                Eventos
              </Link>
              <Link to="/create-event" className="text-sm font-medium text-foreground hover:text-primary transition-colors py-2">
                Criar Evento
              </Link>
              <Button variant="ghost" asChild className="justify-start">
                <Link to="/login">Entrar</Link>
              </Button>
              <Button variant="hero" asChild>
                <Link to="/signup">Cadastrar</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};
