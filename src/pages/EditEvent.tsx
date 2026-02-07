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
import { Trash2, Plus, Copy, Eye, Code2 } from "lucide-react";
import { logActivity } from "@/hooks/useActivityLog";
import { ImageUpload } from "@/components/ImageUpload";
import { DatePicker } from "@/components/DatePicker";
import { Badge } from "@/components/ui/badge";
import { EventPreview } from "@/components/EventPreview";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { LocationMap } from "@/components/LocationMap";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
  const { user, userRole, isProducerApproved, loading } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();

  const [loadingData, setLoadingData] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [eventDate, setEventDate] = useState<Date | undefined>();
  const [eventEndDate, setEventEndDate] = useState<Date | undefined>();
  const [venue, setVenue] = useState("");
  const [address, setAddress] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [addressComplement, setAddressComplement] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [autoAdvanceBatches, setAutoAdvanceBatches] = useState(true);
  const [googlePixelCode, setGooglePixelCode] = useState("");
  const [metaPixelCode, setMetaPixelCode] = useState("");
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
    if (!loading && (!user || (userRole !== "admin" && !isProducerApproved))) {
      navigate("/minha-conta");
    }
  }, [user, userRole, isProducerApproved, loading, navigate]);

  useEffect(() => {
    if (!loading && user && id) {
      fetchCategories();
      fetchEventData();
    }
  }, [id, user, loading]);

  const fetchCategories = async () => {
    const { data } = await supabase.from("categories").select("*").order("name");
    if (data) setCategories(data);
  };

  const fetchEventData = async () => {
    try {
      console.log("Fetching event data, userRole:", userRole, "user:", user?.id);
      
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("*")
        .eq("id", id)
        .single();

      console.log("Event data:", eventData, "Error:", eventError);

      if (eventError) {
        console.error("Event fetch error:", eventError);
        throw eventError;
      }

      if (!eventData) {
        throw new Error("Evento não encontrado");
      }

      console.log("Checking permissions - userRole:", userRole, "producer_id:", eventData.producer_id, "user_id:", user?.id);

      // Allow admins to edit any event, producers can only edit their own
      if (userRole !== "admin" && eventData.producer_id !== user?.id) {
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
      setEventEndDate(eventData.event_end_date ? new Date(eventData.event_end_date) : undefined);
      setVenue(eventData.venue);
      setAddress(eventData.address);
      setAddressNumber(eventData.address_number || "");
      setAddressComplement(eventData.address_complement || "");
      setImageUrl(eventData.image_url || "");
      setIsPublished(eventData.is_published);
      setAutoAdvanceBatches(eventData.auto_advance_batches ?? true);
      setGooglePixelCode(eventData.google_pixel_code || "");
      setMetaPixelCode(eventData.meta_pixel_code || "");

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
            sale_start_date: t.sale_start_date || "",
            sale_end_date: t.sale_end_date || "",
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
    if (!newBatchName || !newBatchPrice || !newBatchQuantity) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha nome, preço e quantidade do lote",
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

    toast({
      title: "Lote adicionado!",
      description: "O novo lote foi adicionado com sucesso",
    });
  };

  const handleDuplicateBatch = (batchId: string) => {
    const batchToDuplicate = ticketBatches.find(b => b.id === batchId);
    if (!batchToDuplicate) return;

    // Preenche o formulário com os dados do lote a ser duplicado
    setNewBatchName(`${batchToDuplicate.batch_name} (Cópia)`);
    setNewBatchSector(batchToDuplicate.sector);
    setNewBatchPrice(batchToDuplicate.price.toString());
    setNewBatchQuantity(batchToDuplicate.quantity_total.toString());
    setNewBatchStartDate(new Date(batchToDuplicate.sale_start_date));
    setNewBatchEndDate(new Date(batchToDuplicate.sale_end_date));

    // Scroll suave até o formulário de novo lote
    setTimeout(() => {
      document.getElementById('new-batch-form')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);

    toast({
      title: "Lote duplicado!",
      description: "Ajuste os dados e clique em Adicionar Lote",
    });
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

  const validatePixelCode = (code: string, type: string): boolean => {
    if (!code.trim()) return true; // Empty is valid (optional field)
    
    // Check if it contains script tags or other valid tracking code elements
    const hasScript = /<script[\s\S]*?>[\s\S]*?<\/script>/i.test(code);
    const hasNoScript = /<noscript[\s\S]*?>[\s\S]*?<\/noscript>/i.test(code);
    const hasImg = /<img[\s\S]*?>/i.test(code);
    const hasIframe = /<iframe[\s\S]*?>[\s\S]*?<\/iframe>/i.test(code);
    
    if (!hasScript && !hasNoScript && !hasImg && !hasIframe) {
      toast({
        title: `Código de pixel ${type} inválido`,
        description: "O código deve conter tags HTML válidas como <script>, <noscript>, <img> ou <iframe>",
        variant: "destructive",
      });
      return false;
    }
    
    // Basic security check - prevent obviously malicious code
    const dangerousPatterns = [
      /document\.cookie/i,
      /localStorage\./i,
      /sessionStorage\./i,
      /eval\(/i,
    ];
    
    const hasDangerousCode = dangerousPatterns.some(pattern => pattern.test(code));
    if (hasDangerousCode) {
      toast({
        title: `Código de pixel ${type} contém padrões suspeitos`,
        description: "O código não pode acessar cookies, localStorage ou usar eval()",
        variant: "destructive",
      });
      return false;
    }
    
    return true;
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

    if (eventEndDate && eventEndDate < eventDate) {
      toast({
        title: "Data inválida",
        description: "A data de término deve ser posterior à data de início",
        variant: "destructive",
      });
      return;
    }

    // Validate pixel codes
    if (!validatePixelCode(googlePixelCode, "do Google Ads")) {
      return;
    }
    
    if (!validatePixelCode(metaPixelCode, "do Meta")) {
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
          event_end_date: eventEndDate?.toISOString() || null,
          venue,
          address,
          address_number: addressNumber || null,
          address_complement: addressComplement || null,
          image_url: imageUrl || null,
          is_published: isPublished,
          auto_advance_batches: autoAdvanceBatches,
          google_pixel_code: googlePixelCode || null,
          meta_pixel_code: metaPixelCode || null,
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
            sale_start_date: batch.sale_start_date ? new Date(batch.sale_start_date).toISOString() : null,
            sale_end_date: batch.sale_end_date ? new Date(batch.sale_end_date).toISOString() : null,
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
              sale_start_date: batch.sale_start_date ? new Date(batch.sale_start_date).toISOString() : null,
              sale_end_date: batch.sale_end_date ? new Date(batch.sale_end_date).toISOString() : null,
            })
            .eq("id", batch.id);

          if (updateError) throw updateError;
        }
      }

      await logActivity({
        actionType: "update",
        entityType: "event",
        entityId: id,
        entityName: title,
      });

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

  // Allow admins or approved producers
  if (userRole !== "admin" && !isProducerApproved) {
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

                <div className="space-y-2">
                  <Label htmlFor="eventDate">Data e Horário do Evento *</Label>
                  <DatePicker
                    date={eventDate}
                    onDateChange={setEventDate}
                    placeholder="Selecione a data e horário do evento"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="eventEndDate">Data e Horário de Término</Label>
                  <DatePicker
                    date={eventEndDate}
                    onDateChange={setEventEndDate}
                    placeholder="Selecione a data e horário de término (opcional)"
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

                <AddressAutocomplete
                  address={address}
                  number={addressNumber}
                  complement={addressComplement}
                  onAddressChange={setAddress}
                  onNumberChange={setAddressNumber}
                  onComplementChange={setAddressComplement}
                  required
                />

                {address && (
                  <div className="space-y-2">
                    <Label>Preview da Localização</Label>
                    <LocationMap 
                      address={address}
                      addressNumber={addressNumber}
                      venue={venue}
                      showOpenButtons={false}
                    />
                  </div>
                )}

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

                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center space-x-2">
                    <Switch id="isPublished" checked={isPublished} onCheckedChange={setIsPublished} />
                    <Label htmlFor="isPublished">Publicar evento</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="autoAdvanceBatches" 
                      checked={autoAdvanceBatches} 
                      onCheckedChange={setAutoAdvanceBatches} 
                    />
                    <div className="space-y-1">
                      <Label htmlFor="autoAdvanceBatches">Avanço automático de lotes</Label>
                      <p className="text-xs text-muted-foreground">
                        Ao esgotar um lote, o próximo lote do mesmo setor ficará disponível automaticamente
                      </p>
                    </div>
                  </div>
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
                    {[...ticketBatches].sort((a, b) => 
                      new Date(a.sale_start_date).getTime() - new Date(b.sale_start_date).getTime()
                    ).map((batch, index, sortedBatches) => {
                      // Check if this is the next batch to be auto-activated
                      const isNextBatch = autoAdvanceBatches && batch.sector && index > 0 && 
                        sortedBatches[index - 1].sector === batch.sector;
                      
                      return (
                        <Card key={batch.id} className="p-4">
                          <div className="space-y-4">
                            <div className="flex justify-between items-center mb-2">
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold">
                                  {batch.isNew ? "Novo Lote" : batch.batch_name}
                                  {batch.quantity_sold > 0 && (
                                    <span className="text-sm text-muted-foreground ml-2">
                                      ({batch.quantity_sold} vendidos)
                                    </span>
                                  )}
                                </h4>
                                {isNextBatch && (
                                  <Badge variant="secondary" className="text-xs">
                                    Próximo lote
                                  </Badge>
                                )}
                              </div>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleDuplicateBatch(batch.id)}
                                title="Duplicar lote"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => handleRemoveBatch(batch.id)}
                                disabled={batch.quantity_sold > 0}
                                title={batch.quantity_sold > 0 ? "Não é possível excluir lotes com vendas" : "Remover lote"}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
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
                              <Label>Início das Vendas (opcional)</Label>
                              <DatePicker
                                date={batch.sale_start_date ? new Date(batch.sale_start_date) : undefined}
                                onDateChange={(date) => handleUpdateBatch(batch.id, 'sale_start_date', date?.toISOString() || null)}
                                placeholder="Automático (virada de lotes)"
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                Se não definido, segue a virada automática
                              </p>
                            </div>
                            <div>
                              <Label>Fim das Vendas (opcional)</Label>
                              <DatePicker
                                date={batch.sale_end_date ? new Date(batch.sale_end_date) : undefined}
                                onDateChange={(date) => handleUpdateBatch(batch.id, 'sale_end_date', date?.toISOString() || null)}
                                placeholder="Automático (virada de lotes)"
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                Se não definido, segue a virada automática
                              </p>
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                    })}
                  </div>
                )}

                <div className="border-t pt-6" id="new-batch-form">
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
                      <Label>Início das Vendas (opcional)</Label>
                      <DatePicker
                        date={newBatchStartDate}
                        onDateChange={setNewBatchStartDate}
                        placeholder="Automático (virada de lotes)"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Se não definido, segue a virada automática
                      </p>
                    </div>
                    <div>
                      <Label>Fim das Vendas (opcional)</Label>
                      <DatePicker
                        date={newBatchEndDate}
                        onDateChange={setNewBatchEndDate}
                        placeholder="Automático (virada de lotes)"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Se não definido, segue a virada automática
                      </p>
                    </div>
                  </div>
                  <Button type="button" variant="outline" className="mt-4" onClick={handleAddBatch}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Lote
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pixels de Rastreamento</CardTitle>
                <CardDescription>
                  Códigos de rastreamento para campanhas de tráfego pago (opcional)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="googlePixelCode">Pixel do Google Ads</Label>
                    {googlePixelCode && (
                      <Collapsible>
                        <CollapsibleTrigger asChild>
                          <Button type="button" variant="outline" size="sm" className="gap-2">
                            <Code2 className="h-4 w-4" />
                            Ver Preview
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2">
                          <div className="rounded-md bg-muted p-4 overflow-auto max-h-60">
                            <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                              {googlePixelCode}
                            </pre>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </div>
                  <Textarea
                    id="googlePixelCode"
                    value={googlePixelCode}
                    onChange={(e) => setGooglePixelCode(e.target.value)}
                    placeholder="Cole o código completo do pixel do Google Ads aqui&#10;Exemplo: <script>...</script>"
                    rows={6}
                    className="font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    Este código será injetado na página do evento para rastrear visualizações e conversões
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="metaPixelCode">Pixel do Meta (Facebook/Instagram)</Label>
                    {metaPixelCode && (
                      <Collapsible>
                        <CollapsibleTrigger asChild>
                          <Button type="button" variant="outline" size="sm" className="gap-2">
                            <Code2 className="h-4 w-4" />
                            Ver Preview
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2">
                          <div className="rounded-md bg-muted p-4 overflow-auto max-h-60">
                            <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                              {metaPixelCode}
                            </pre>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </div>
                  <Textarea
                    id="metaPixelCode"
                    value={metaPixelCode}
                    onChange={(e) => setMetaPixelCode(e.target.value)}
                    placeholder="Cole o código completo do pixel do Meta aqui&#10;Exemplo: <script>...</script>"
                    rows={6}
                    className="font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    Este código será injetado na página do evento para rastrear visualizações e conversões
                  </p>
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
