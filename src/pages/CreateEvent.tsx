import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Eye, Copy, Edit, GripVertical } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { ImageUpload } from "@/components/ImageUpload";
import { EventPreview } from "@/components/EventPreview";
import { DatePicker } from "@/components/DatePicker";
import { Badge } from "@/components/ui/badge";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
  position: number;
}

interface SortableTicketBatchProps {
  batch: TicketBatch;
  index: number;
  isNextBatch: boolean;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
}

const SortableTicketBatch = ({ batch, index, isNextBatch, onEdit, onDuplicate, onRemove }: SortableTicketBatchProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: batch.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-4 border rounded-lg bg-card"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>
      
      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold">{batch.batch_name}</p>
            {isNextBatch && (
              <Badge variant="secondary" className="text-xs">
                Próximo lote
              </Badge>
            )}
          </div>
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
            {batch.sale_start_date ? new Date(batch.sale_start_date).toLocaleDateString("pt-BR") : "Não definido"} -{" "}
            {batch.sale_end_date ? new Date(batch.sale_end_date).toLocaleDateString("pt-BR") : "Não definido"}
          </p>
        </div>
      </div>
      
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onEdit(batch.id)}
          title="Editar lote"
        >
          <Edit className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onDuplicate(batch.id)}
          title="Duplicar lote"
        >
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onRemove(batch.id)}
          title="Remover lote"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

const CreateEvent = () => {
  const { user, isProducerApproved, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const duplicateFrom = location.state?.duplicateFrom;
  const [categories, setCategories] = useState<Category[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Event form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
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
  
  // Ticket batches state
  const [ticketBatches, setTicketBatches] = useState<TicketBatch[]>([]);
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [currentBatch, setCurrentBatch] = useState<{
    batch_name?: string;
    sector?: string;
    price?: number;
    quantity_total?: number;
    sale_start_date?: Date;
    sale_end_date?: Date;
  }>({
    batch_name: "",
    sector: "",
    price: 0,
    quantity_total: 0,
    sale_start_date: undefined,
    sale_end_date: undefined,
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (!loading && (!user || !isProducerApproved)) {
      navigate("/minha-conta");
    }
  }, [user, isProducerApproved, loading, navigate]);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (duplicateFrom && categories.length > 0) {
      // Pre-fill form with duplicated event data
      setTitle(`${duplicateFrom.title} (Cópia)`);
      setDescription(duplicateFrom.description || "");
      
      // Find category ID by name
      const category = categories.find(c => c.name === duplicateFrom.category);
      if (category) {
        setCategoryId(category.id);
      }
      
      setVenue(duplicateFrom.venue);
      setAddress(duplicateFrom.address);
      setAddressNumber(duplicateFrom.address_number || "");
      setAddressComplement(duplicateFrom.address_complement || "");
      setImageUrl(duplicateFrom.image_url || "");
      setIsPublished(false); // Always start as draft for duplicates
      
      // Pre-fill ticket batches
      if (duplicateFrom.tickets && duplicateFrom.tickets.length > 0) {
        const batches = duplicateFrom.tickets.map((ticket: any, index: number) => ({
          id: crypto.randomUUID(),
          batch_name: ticket.batch_name,
          sector: ticket.sector || "",
          price: Number(ticket.price),
          quantity_total: ticket.quantity_total,
          sale_start_date: ticket.sale_start_date,
          sale_end_date: ticket.sale_end_date,
          position: index,
        }));
        setTicketBatches(batches);
      }

      toast.success("Evento duplicado! Ajuste os dados e salve.");
    }
  }, [duplicateFrom, categories]);

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

    if (editingBatchId) {
      // Editing existing batch
      setTicketBatches(ticketBatches.map(batch => 
        batch.id === editingBatchId
          ? {
              ...batch,
              batch_name: currentBatch.batch_name!,
              sector: currentBatch.sector || "",
              price: Number(currentBatch.price),
              quantity_total: Number(currentBatch.quantity_total),
              sale_start_date: currentBatch.sale_start_date?.toISOString() || "",
              sale_end_date: currentBatch.sale_end_date?.toISOString() || "",
            }
          : batch
      ));
      toast.success("Lote atualizado!");
    } else {
      // Adding new batch
      const newBatch: TicketBatch = {
        id: crypto.randomUUID(),
        batch_name: currentBatch.batch_name!,
        sector: currentBatch.sector || "",
        price: Number(currentBatch.price),
        quantity_total: Number(currentBatch.quantity_total),
        sale_start_date: currentBatch.sale_start_date?.toISOString() || "",
        sale_end_date: currentBatch.sale_end_date?.toISOString() || "",
        position: ticketBatches.length,
      };
      setTicketBatches([...ticketBatches, newBatch]);
      toast.success("Lote adicionado!");
    }

    setCurrentBatch({
      batch_name: "",
      sector: "",
      price: 0,
      quantity_total: 0,
      sale_start_date: undefined,
      sale_end_date: undefined,
    });
    setShowBatchForm(false);
    setEditingBatchId(null);
  };

  const handleEditBatch = (batchId: string) => {
    const batchToEdit = ticketBatches.find(b => b.id === batchId);
    if (!batchToEdit) return;

    setCurrentBatch({
      batch_name: batchToEdit.batch_name,
      sector: batchToEdit.sector,
      price: batchToEdit.price,
      quantity_total: batchToEdit.quantity_total,
      sale_start_date: batchToEdit.sale_start_date ? new Date(batchToEdit.sale_start_date) : undefined,
      sale_end_date: batchToEdit.sale_end_date ? new Date(batchToEdit.sale_end_date) : undefined,
    });
    setEditingBatchId(batchId);
    setShowBatchForm(true);
  };

  const handleDuplicateBatch = (batchId: string) => {
    const batchToDuplicate = ticketBatches.find(b => b.id === batchId);
    if (!batchToDuplicate) return;

    setCurrentBatch({
      batch_name: `${batchToDuplicate.batch_name} (Cópia)`,
      sector: batchToDuplicate.sector,
      price: batchToDuplicate.price,
      quantity_total: batchToDuplicate.quantity_total,
      sale_start_date: batchToDuplicate.sale_start_date ? new Date(batchToDuplicate.sale_start_date) : undefined,
      sale_end_date: batchToDuplicate.sale_end_date ? new Date(batchToDuplicate.sale_end_date) : undefined,
    });
    setEditingBatchId(null);
    setShowBatchForm(true);
    toast.success("Lote duplicado! Ajuste os dados e adicione.");
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setTicketBatches((batches) => {
        const oldIndex = batches.findIndex((b) => b.id === active.id);
        const newIndex = batches.findIndex((b) => b.id === over.id);
        
        const newBatches = arrayMove(batches, oldIndex, newIndex);
        // Update positions
        return newBatches.map((batch, index) => ({ ...batch, position: index }));
      });
      toast.success("Ordem dos lotes atualizada!");
    }
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

    if (eventEndDate && eventEndDate < eventDate) {
      toast.error("A data de término deve ser posterior à data de início");
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
    <>
      <main className="container mx-auto px-4 py-8">
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

              <AddressAutocomplete
                address={address}
                number={addressNumber}
                complement={addressComplement}
                onAddressChange={setAddress}
                onNumberChange={setAddressNumber}
                onComplementChange={setAddressComplement}
                required
              />

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

              <ImageUpload
                currentImageUrl={imageUrl}
                onImageUploaded={setImageUrl}
                onImageRemoved={() => setImageUrl("")}
              />

              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isPublished"
                    checked={isPublished}
                    onCheckedChange={setIsPublished}
                  />
                  <Label htmlFor="isPublished">Publicar evento imediatamente</Label>
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
              <CardTitle>Pixels de Rastreamento</CardTitle>
              <CardDescription>
                Códigos de rastreamento para campanhas de tráfego pago (opcional)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="googlePixelCode">Pixel do Google Ads</Label>
                <Textarea
                  id="googlePixelCode"
                  value={googlePixelCode}
                  onChange={(e) => setGooglePixelCode(e.target.value)}
                  placeholder='Cole o código completo do pixel do Google Ads aqui&#10;Exemplo: <script>...</script>'
                  rows={6}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Este código será injetado na página do evento para rastrear visualizações e conversões
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="metaPixelCode">Pixel do Meta (Facebook/Instagram)</Label>
                <Textarea
                  id="metaPixelCode"
                  value={metaPixelCode}
                  onChange={(e) => setMetaPixelCode(e.target.value)}
                  placeholder='Cole o código completo do pixel do Meta aqui&#10;Exemplo: <script>...</script>'
                  rows={6}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Este código será injetado na página do evento para rastrear visualizações e conversões
                </p>
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
                          value={currentBatch.price || ""}
                          onChange={(e) => setCurrentBatch({ ...currentBatch, price: e.target.value === "" ? 0 : Number(e.target.value) })}
                          placeholder="0.00"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Quantidade *</Label>
                        <Input
                          type="number"
                          min="1"
                          value={currentBatch.quantity_total || ""}
                          onChange={(e) => setCurrentBatch({ ...currentBatch, quantity_total: e.target.value === "" ? 0 : Number(e.target.value) })}
                          placeholder="100"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Início das Vendas</Label>
                        <DatePicker
                          date={currentBatch.sale_start_date}
                          onDateChange={(date) => setCurrentBatch({ ...currentBatch, sale_start_date: date })}
                          placeholder="Selecione o início das vendas"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Fim das Vendas</Label>
                        <DatePicker
                          date={currentBatch.sale_end_date}
                          onDateChange={(date) => setCurrentBatch({ ...currentBatch, sale_end_date: date })}
                          placeholder="Selecione o fim das vendas"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button type="button" onClick={handleAddBatch}>
                        {editingBatchId ? "Salvar" : "Adicionar"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowBatchForm(false);
                          setEditingBatchId(null);
                          setCurrentBatch({
                            batch_name: "",
                            sector: "",
                            price: 0,
                            quantity_total: 0,
                            sale_start_date: undefined,
                            sale_end_date: undefined,
                          });
                        }}
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
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={ticketBatches.map(b => b.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {ticketBatches
                        .sort((a, b) => a.position - b.position)
                        .map((batch, index, sortedBatches) => {
                          // Check if this is the next batch to be auto-activated
                          const isNextBatch = autoAdvanceBatches && batch.sector && index > 0 && 
                            sortedBatches[index - 1].sector === batch.sector;
                          
                          return (
                            <SortableTicketBatch
                              key={batch.id}
                              batch={batch}
                              index={index}
                              isNextBatch={isNextBatch}
                              onEdit={handleEditBatch}
                              onDuplicate={handleDuplicateBatch}
                              onRemove={handleRemoveBatch}
                            />
                          );
                        })}
                    </div>
                  </SortableContext>
                </DndContext>
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
            
            <Dialog>
              <DialogTrigger asChild>
                <Button type="button" variant="secondary" className="gap-2">
                  <Eye className="h-4 w-4" />
                  Visualizar Preview
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-6xl">
                <DialogHeader>
                  <DialogTitle>Preview do Evento</DialogTitle>
                </DialogHeader>
                <EventPreview
                  title={title}
                  description={description}
                  category={categories.find(c => c.id === categoryId)?.name || ""}
                  eventDate={eventDate}
                  venue={venue}
                  address={address}
                  imageUrl={imageUrl}
                  ticketBatches={ticketBatches}
                />
              </DialogContent>
            </Dialog>
            
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Criando..." : "Criar Evento"}
            </Button>
          </div>
        </form>
      </main>

      <Footer />
    </>
  );
};

export default CreateEvent;
