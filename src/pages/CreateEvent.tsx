import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Upload, Plus, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface Category {
  id: string;
  name: string;
}

interface TicketBatch {
  id: string;
  batch_name: string;
  sector: string;
  price: number;
  quantity_total: number;
  sale_start_date: string;
  sale_end_date: string;
}

const CreateEvent = () => {
  const { user, isProducerApproved, loading } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Event form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [venue, setVenue] = useState("");
  const [address, setAddress] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  
  // Ticket batches state
  const [ticketBatches, setTicketBatches] = useState<TicketBatch[]>([]);
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [currentBatch, setCurrentBatch] = useState<Partial<TicketBatch>>({
    batch_name: "",
    sector: "",
    price: 0,
    quantity_total: 0,
    sale_start_date: "",
    sale_end_date: "",
  });

  useEffect(() => {
    if (!loading && (!user || !isProducerApproved)) {
      navigate("/minha-conta");
    }
  }, [user, isProducerApproved, loading, navigate]);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name")
        .order("name");

      if (error) throw error;
      if (data) setCategories(data);
    } catch (error) {
      console.error("Error fetching categories:", error);
      toast.error("Erro ao carregar categorias");
    }
  };

  const handleAddBatch = () => {
    if (!currentBatch.batch_name || !currentBatch.price || !currentBatch.quantity_total) {
      toast.error("Preencha todos os campos obrigatórios do lote");
      return;
    }

    const newBatch: TicketBatch = {
      id: crypto.randomUUID(),
      batch_name: currentBatch.batch_name!,
      sector: currentBatch.sector || "",
      price: Number(currentBatch.price),
      quantity_total: Number(currentBatch.quantity_total),
      sale_start_date: currentBatch.sale_start_date!,
      sale_end_date: currentBatch.sale_end_date!,
    };

    setTicketBatches([...ticketBatches, newBatch]);
    setCurrentBatch({
      batch_name: "",
      sector: "",
      price: 0,
      quantity_total: 0,
      sale_start_date: "",
      sale_end_date: "",
    });
    setShowBatchForm(false);
    toast.success("Lote adicionado!");
  };

  const handleRemoveBatch = (id: string) => {
    setTicketBatches(ticketBatches.filter(batch => batch.id !== id));
    toast.success("Lote removido!");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title || !categoryId || !eventDate || !venue || !address) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (ticketBatches.length === 0) {
      toast.error("Adicione pelo menos um lote de ingressos");
      return;
    }

    setIsSubmitting(true);

    try {
      // Find category name
      const category = categories.find(c => c.id === categoryId);
      
      // Create event
      const { data: event, error: eventError } = await supabase
        .from("events")
        .insert({
          title,
          description,
          category: category?.name || "",
          event_date: eventDate,
          venue,
          address,
          image_url: imageUrl || null,
          is_published: isPublished,
          status: "approved",
          producer_id: user?.id,
        })
        .select()
        .single();

      if (eventError) throw eventError;

      // Create ticket batches
      const ticketsToInsert = ticketBatches.map(batch => ({
        event_id: event.id,
        batch_name: batch.batch_name,
        sector: batch.sector || null,
        price: batch.price,
        quantity_total: batch.quantity_total,
        quantity_sold: 0,
        sale_start_date: batch.sale_start_date,
        sale_end_date: batch.sale_end_date,
      }));

      const { error: ticketsError } = await supabase
        .from("tickets")
        .insert(ticketsToInsert);

      if (ticketsError) throw ticketsError;

      toast.success("Evento criado com sucesso!");
      navigate("/painel");
    } catch (error) {
      console.error("Error creating event:", error);
      toast.error("Erro ao criar evento");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Carregando...</p>
      </div>
    );
  }

  if (!isProducerApproved) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/painel")}
          className="mb-6 gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao Painel
        </Button>

        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Criar Novo Evento</h1>
          <p className="text-muted-foreground">
            Preencha os dados do evento e configure os lotes de ingressos
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informações do Evento</CardTitle>
              <CardDescription>
                Dados principais sobre o evento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título do Evento *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Nome do evento"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Categoria *</Label>
                  <Select value={categoryId} onValueChange={setCategoryId} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="eventDate">Data e Hora *</Label>
                  <Input
                    id="eventDate"
                    type="datetime-local"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="venue">Local *</Label>
                  <Input
                    id="venue"
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    placeholder="Nome do local"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Endereço Completo *</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Rua, número, bairro, cidade - UF"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descreva os detalhes do evento"
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="imageUrl">URL da Imagem</Label>
                <div className="flex gap-2">
                  <Input
                    id="imageUrl"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://exemplo.com/imagem.jpg"
                  />
                  <Button type="button" variant="outline" size="icon">
                    <Upload className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isPublished"
                  checked={isPublished}
                  onCheckedChange={setIsPublished}
                />
                <Label htmlFor="isPublished">Publicar evento imediatamente</Label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Lotes de Ingressos</CardTitle>
                  <CardDescription>
                    Configure os tipos e valores dos ingressos
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  onClick={() => setShowBatchForm(!showBatchForm)}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar Lote
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {showBatchForm && (
                <Card className="border-2 border-primary">
                  <CardContent className="pt-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nome do Lote *</Label>
                        <Input
                          value={currentBatch.batch_name}
                          onChange={(e) => setCurrentBatch({ ...currentBatch, batch_name: e.target.value })}
                          placeholder="Ex: 1º Lote"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Setor</Label>
                        <Input
                          value={currentBatch.sector}
                          onChange={(e) => setCurrentBatch({ ...currentBatch, sector: e.target.value })}
                          placeholder="Ex: Pista, Camarote"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Preço (R$) *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={currentBatch.price}
                          onChange={(e) => setCurrentBatch({ ...currentBatch, price: Number(e.target.value) })}
                          placeholder="0.00"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Quantidade *</Label>
                        <Input
                          type="number"
                          min="1"
                          value={currentBatch.quantity_total}
                          onChange={(e) => setCurrentBatch({ ...currentBatch, quantity_total: Number(e.target.value) })}
                          placeholder="100"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Início das Vendas *</Label>
                        <Input
                          type="datetime-local"
                          value={currentBatch.sale_start_date}
                          onChange={(e) => setCurrentBatch({ ...currentBatch, sale_start_date: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Fim das Vendas *</Label>
                        <Input
                          type="datetime-local"
                          value={currentBatch.sale_end_date}
                          onChange={(e) => setCurrentBatch({ ...currentBatch, sale_end_date: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button type="button" onClick={handleAddBatch}>
                        Adicionar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowBatchForm(false)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {ticketBatches.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum lote adicionado. Clique em "Adicionar Lote" para começar.
                </div>
              ) : (
                <div className="space-y-2">
                  {ticketBatches.map((batch) => (
                    <div
                      key={batch.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <p className="font-semibold">{batch.batch_name}</p>
                          {batch.sector && <p className="text-sm text-muted-foreground">{batch.sector}</p>}
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Preço</p>
                          <p className="font-semibold">R$ {batch.price.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Quantidade</p>
                          <p className="font-semibold">{batch.quantity_total}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Período de Vendas</p>
                          <p className="text-xs">
                            {new Date(batch.sale_start_date).toLocaleDateString("pt-BR")} -{" "}
                            {new Date(batch.sale_end_date).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveBatch(batch.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/painel")}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Criando..." : "Criar Evento"}
            </Button>
          </div>
        </form>
      </main>

      <Footer />
    </div>
  );
};

export default CreateEvent;
