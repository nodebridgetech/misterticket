import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useParams } from "react-router-dom";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus } from "lucide-react";
import { ImageUpload } from "@/components/ImageUpload";
import { DatePicker } from "@/components/DatePicker";

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
  quantity_sold: number;
  sale_start_date: string;
  sale_end_date: string;
  isNew?: boolean;
}

const EditEvent = () => {
  const { user, isProducerApproved, loading } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();

  const [loadingData, setLoadingData] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [eventDate, setEventDate] = useState<Date | undefined>();
  const [venue, setVenue] = useState("");
  const [address, setAddress] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [ticketBatches, setTicketBatches] = useState<TicketBatch[]>([]);
  const [deletedBatchIds, setDeletedBatchIds] = useState<string[]>([]);

  // New batch form
  const [newBatchName, setNewBatchName] = useState("");
  const [newBatchSector, setNewBatchSector] = useState("");
  const [newBatchPrice, setNewBatchPrice] = useState("");
  const [newBatchQuantity, setNewBatchQuantity] = useState("");
  const [newBatchStartDate, setNewBatchStartDate] = useState<Date | undefined>();
  const [newBatchEndDate, setNewBatchEndDate] = useState<Date | undefined>();

  useEffect(() => {
    if (!loading && (!user || !isProducerApproved)) {
      navigate("/minha-conta");
    }
  }, [user, isProducerApproved, loading, navigate]);

  useEffect(() => {
    fetchCategories();
    if (id) {
      fetchEventData();
    }
  }, [id]);

  const fetchCategories = async () => {
    const { data } = await supabase.from("categories").select("*").order("name");
    if (data) setCategories(data);
  };

  const fetchEventData = async () => {
    try {
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("*")
        .eq("id", id)
        .single();

      if (eventError) throw eventError;

      if (eventData.producer_id !== user?.id) {
        toast({
          title: "Acesso negado",
          description: "Você não tem permissão para editar este evento",
          variant: "destructive",
        });
        navigate("/painel-produtor");
        return;
      }

      setTitle(eventData.title);
      setDescription(eventData.description || "");
      setCategory(eventData.category);
      setEventDate(new Date(eventData.event_date));
      setVenue(eventData.venue);
      setAddress(eventData.address);
      setImageUrl(eventData.image_url || "");
      setIsPublished(eventData.is_published);

      const { data: ticketsData } = await supabase
        .from("tickets")
        .select("*")
        .eq("event_id", id)
        .order("created_at");

      if (ticketsData) {
        setTicketBatches(
          ticketsData.map((t) => ({
            id: t.id,
            batch_name: t.batch_name,
            sector: t.sector || "",
            price: Number(t.price),
            quantity_total: t.quantity_total,
            quantity_sold: t.quantity_sold,
            sale_start_date: new Date(t.sale_start_date).toISOString().slice(0, 16),
            sale_end_date: new Date(t.sale_end_date).toISOString().slice(0, 16),
          }))
        );
      }
    } catch (error) {
      console.error("Error fetching event:", error);
      toast({
        title: "Erro ao carregar evento",
        description: "Não foi possível carregar os dados do evento",
        variant: "destructive",
      });
    } finally {
      setLoadingData(false);
    }
  };

  const handleAddBatch = () => {
    if (!newBatchName || !newBatchPrice || !newBatchQuantity || !newBatchStartDate || !newBatchEndDate) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos do lote",
        variant: "destructive",
      });
      return;
    }

    const newBatch: TicketBatch = {
      id: `new-${Date.now()}`,
      batch_name: newBatchName,
      sector: newBatchSector,
      price: parseFloat(newBatchPrice),
      quantity_total: parseInt(newBatchQuantity),
      quantity_sold: 0,
      sale_start_date: newBatchStartDate?.toISOString() || "",
      sale_end_date: newBatchEndDate?.toISOString() || "",
      isNew: true,
    };

    setTicketBatches([...ticketBatches, newBatch]);
    setNewBatchName("");
    setNewBatchSector("");
    setNewBatchPrice("");
    setNewBatchQuantity("");
    setNewBatchStartDate(undefined);
    setNewBatchEndDate(undefined);
  };

  const handleRemoveBatch = (batchId: string) => {
    if (!batchId.startsWith("new-")) {
      setDeletedBatchIds([...deletedBatchIds, batchId]);
    }
    setTicketBatches(ticketBatches.filter((b) => b.id !== batchId));
  };

  const handleUpdateBatch = (batchId: string, field: keyof TicketBatch, value: any) => {
    setTicketBatches(ticketBatches.map(batch => 
      batch.id === batchId 
        ? { ...batch, [field]: value }
        : batch
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title || !category || !eventDate || !venue || !address) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios do evento",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error: eventError } = await supabase
        .from("events")
        .update({
          title,
          description,
          category,
          event_date: eventDate?.toISOString() || new Date().toISOString(),
          venue,
          address,
          image_url: imageUrl || null,
          is_published: isPublished,
        })
        .eq("id", id);

      if (eventError) throw eventError;

      // Delete removed batches
      if (deletedBatchIds.length > 0) {
        const { error: deleteError } = await supabase
          .from("tickets")
          .delete()
          .in("id", deletedBatchIds);

        if (deleteError) throw deleteError;
      }

      // Update existing and insert new batches
      for (const batch of ticketBatches) {
        if (batch.isNew) {
          const { error: insertError } = await supabase.from("tickets").insert({
            event_id: id,
            batch_name: batch.batch_name,
            sector: batch.sector || null,
            price: batch.price,
            quantity_total: batch.quantity_total,
            quantity_sold: 0,
            sale_start_date: new Date(batch.sale_start_date).toISOString(),
            sale_end_date: new Date(batch.sale_end_date).toISOString(),
          });

          if (insertError) throw insertError;
        } else {
          const { error: updateError } = await supabase
            .from("tickets")
            .update({
              batch_name: batch.batch_name,
              sector: batch.sector || null,
              price: batch.price,
              quantity_total: batch.quantity_total,
              sale_start_date: new Date(batch.sale_start_date).toISOString(),
              sale_end_date: new Date(batch.sale_end_date).toISOString(),
            })
            .eq("id", batch.id);

          if (updateError) throw updateError;
        }
      }

      toast({
        title: "Evento atualizado!",
        description: "O evento foi atualizado com sucesso",
      });

      navigate("/painel");
    } catch (error) {
      console.error("Error updating event:", error);
      toast({
        title: "Erro ao atualizar evento",
        description: "Ocorreu um erro ao atualizar o evento",
        variant: "destructive",
      });
    }
  };

  if (loading || loadingData) {
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
    <>
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-8">Editar Evento</h1>

          <form onSubmit={handleSubmit} className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Informações do Evento</CardTitle>
                <CardDescription>Atualize as informações básicas do evento</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="title">Título do Evento *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Nome do evento"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="category">Categoria *</Label>
                  <Select value={category} onValueChange={setCategory} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.name}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="eventDate">Data e Hora *</Label>
                  <DatePicker
                    date={eventDate}
                    onDateChange={setEventDate}
                    placeholder="Selecione a data e hora do evento"
                  />
                </div>

                <div>
                  <Label htmlFor="venue">Local *</Label>
                  <Input
                    id="venue"
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    placeholder="Nome do local"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="address">Endereço *</Label>
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Endereço completo"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descreva o evento"
                    rows={4}
                  />
                </div>

                <ImageUpload
                  currentImageUrl={imageUrl}
                  onImageUploaded={setImageUrl}
                  onImageRemoved={() => setImageUrl("")}
                />

                <div className="flex items-center space-x-2">
                  <Switch id="isPublished" checked={isPublished} onCheckedChange={setIsPublished} />
                  <Label htmlFor="isPublished">Publicar evento</Label>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Lotes de Ingressos</CardTitle>
                <CardDescription>Gerencie os lotes de ingressos do evento</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {ticketBatches.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="font-semibold mb-4">Lotes Cadastrados</h3>
                    {ticketBatches.map((batch) => (
                      <Card key={batch.id} className="p-4">
                        <div className="space-y-4">
                          <div className="flex justify-between items-center mb-2">
                            <h4 className="font-semibold">
                              {batch.isNew ? "Novo Lote" : batch.batch_name}
                              {batch.quantity_sold > 0 && (
                                <span className="text-sm text-muted-foreground ml-2">
                                  ({batch.quantity_sold} vendidos)
                                </span>
                              )}
                            </h4>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => handleRemoveBatch(batch.id)}
                              disabled={batch.quantity_sold > 0}
                              title={batch.quantity_sold > 0 ? "Não é possível excluir lotes com vendas" : ""}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label>Nome do Lote</Label>
                              <Input
                                value={batch.batch_name}
                                onChange={(e) => handleUpdateBatch(batch.id, 'batch_name', e.target.value)}
                                placeholder="Ex: 1º Lote"
                              />
                            </div>
                            <div>
                              <Label>Setor</Label>
                              <Input
                                value={batch.sector}
                                onChange={(e) => handleUpdateBatch(batch.id, 'sector', e.target.value)}
                                placeholder="Ex: Pista"
                              />
                            </div>
                            <div>
                              <Label>Preço (R$)</Label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0.50"
                                value={batch.price || ""}
                                onChange={(e) => handleUpdateBatch(batch.id, 'price', e.target.value === "" ? 0 : parseFloat(e.target.value))}
                                placeholder="0.00"
                              />
                            </div>
                            <div>
                              <Label>Quantidade Total</Label>
                              <Input
                                type="number"
                                value={batch.quantity_total || ""}
                                onChange={(e) => handleUpdateBatch(batch.id, 'quantity_total', e.target.value === "" ? 0 : parseInt(e.target.value))}
                                placeholder="100"
                                disabled={batch.quantity_sold > 0}
                                title={batch.quantity_sold > 0 ? "Não é possível alterar quantidade com vendas realizadas" : ""}
                              />
                              {batch.quantity_sold > 0 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Disponível: {batch.quantity_total - batch.quantity_sold}
                                </p>
                              )}
                            </div>
                            <div>
                              <Label>Início das Vendas</Label>
                              <DatePicker
                                date={new Date(batch.sale_start_date)}
                                onDateChange={(date) => handleUpdateBatch(batch.id, 'sale_start_date', date?.toISOString() || batch.sale_start_date)}
                                placeholder="Selecione o início das vendas"
                              />
                            </div>
                            <div>
                              <Label>Fim das Vendas</Label>
                              <DatePicker
                                date={new Date(batch.sale_end_date)}
                                onDateChange={(date) => handleUpdateBatch(batch.id, 'sale_end_date', date?.toISOString() || batch.sale_end_date)}
                                placeholder="Selecione o fim das vendas"
                              />
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}

                <div className="border-t pt-6">
                  <h3 className="font-semibold mb-4">Adicionar Novo Lote</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Nome do Lote</Label>
                      <Input
                        value={newBatchName}
                        onChange={(e) => setNewBatchName(e.target.value)}
                        placeholder="Ex: 1º Lote"
                      />
                    </div>
                    <div>
                      <Label>Setor (opcional)</Label>
                      <Input
                        value={newBatchSector}
                        onChange={(e) => setNewBatchSector(e.target.value)}
                        placeholder="Ex: Pista"
                      />
                    </div>
                    <div>
                      <Label>Preço (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.50"
                        value={newBatchPrice}
                        onChange={(e) => setNewBatchPrice(e.target.value)}
                        placeholder="0.50"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Mínimo: R$ 0,50</p>
                    </div>
                    <div>
                      <Label>Quantidade</Label>
                      <Input
                        type="number"
                        min="1"
                        value={newBatchQuantity}
                        onChange={(e) => setNewBatchQuantity(e.target.value)}
                        placeholder="100"
                      />
                    </div>
                    <div>
                      <Label>Início das Vendas</Label>
                      <DatePicker
                        date={newBatchStartDate}
                        onDateChange={setNewBatchStartDate}
                        placeholder="Selecione o início das vendas"
                      />
                    </div>
                    <div>
                      <Label>Fim das Vendas</Label>
                      <DatePicker
                        date={newBatchEndDate}
                        onDateChange={setNewBatchEndDate}
                        placeholder="Selecione o fim das vendas"
                      />
                    </div>
                  </div>
                  <Button type="button" variant="outline" className="mt-4" onClick={handleAddBatch}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Lote
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-4">
              <Button type="submit" size="lg">
                Salvar Alterações
              </Button>
              <Button type="button" variant="outline" size="lg" onClick={() => navigate("/painel")}>
                Cancelar
              </Button>
            </div>
          </form>
        </div>
      </main>

      <Footer />
    </>
  );
};

export default EditEvent;
