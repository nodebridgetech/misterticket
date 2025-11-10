export const Footer = () => {
  return (
    <footer className="border-t border-border bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-sm text-muted-foreground">
          <p>
            © {new Date().getFullYear()} Mister Ticket. Todos os direitos reservados. Desenvolvido por{" "}
            <a 
              href="https://nodebridge.com.br/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              NodeBridge
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
};
