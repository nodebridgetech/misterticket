import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Loader2, MessageCircle, Plus, Pencil, Trash2, GripVertical, FileText, Tag, DollarSign } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoryManager } from "@/components/CategoryManager";
import { FeeConfigTab } from "@/components/FeeConfigTab";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface WhatsAppConfig {
  id: string;
  phone_number: string;
  default_message: string;
  is_active: boolean;
}

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  position: number;
  is_active: boolean;
}

interface RefundPolicyConfig {
  id: string;
  policy_text: string;
  is_active: boolean;
}

const SortableFAQItem = ({ 
  item, 
  onEdit, 
  onDelete 
}: { 
  item: FAQItem; 
  onEdit: (item: FAQItem) => void; 
  onDelete: (item: FAQItem) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-4 bg-card border rounded-lg"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{item.question}</p>
        <p className="text-sm text-muted-foreground truncate">{item.answer}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => onEdit(item)}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onDelete(item)}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
};

const SiteSettingsManagement = () => {
  const navigate = useNavigate();
  const { userRole, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // WhatsApp state
  const [whatsappConfig, setWhatsappConfig] = useState<WhatsAppConfig | null>(null);
  const [whatsappForm, setWhatsappForm] = useState({
    phone_number: "",
    default_message: "Olá, estava no misterticket.com.br e preciso de ajuda!",
    is_active: true,
  });

  // FAQ state
  const [faqItems, setFaqItems] = useState<FAQItem[]>([]);
  const [faqDialogOpen, setFaqDialogOpen] = useState(false);
  const [faqDeleteDialogOpen, setFaqDeleteDialogOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQItem | null>(null);
  const [faqToDelete, setFaqToDelete] = useState<FAQItem | null>(null);
  const [faqForm, setFaqForm] = useState({ question: "", answer: "" });

  // Refund policy state
  const [refundPolicy, setRefundPolicy] = useState<RefundPolicyConfig | null>(null);
  const [refundForm, setRefundForm] = useState({
    policy_text: "",
    is_active: true,
  });
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (!authLoading && userRole !== "admin") {
      navigate("/");
    }
  }, [userRole, authLoading, navigate]);

  useEffect(() => {
    if (userRole === "admin") {
      fetchData();
    }
  }, [userRole]);

  const fetchData = async () => {
    setLoading(true);

    // Fetch WhatsApp config
    const { data: whatsapp } = await supabase
      .from("whatsapp_config")
      .select("*")
      .limit(1)
      .single();

    if (whatsapp) {
      setWhatsappConfig(whatsapp);
      setWhatsappForm({
        phone_number: whatsapp.phone_number,
        default_message: whatsapp.default_message,
        is_active: whatsapp.is_active,
      });
    }

    // Fetch FAQ items
    const { data: faq } = await supabase
      .from("faq_items")
      .select("*")
      .order("position", { ascending: true });

    if (faq) {
      setFaqItems(faq);
    }

    // Fetch refund policy
    const { data: refund } = await supabase
      .from("refund_policy_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (refund) {
      setRefundPolicy(refund);
      setRefundForm({
        policy_text: refund.policy_text,
        is_active: refund.is_active,
      });
    }

    setLoading(false);
  };

  const handleSaveWhatsApp = async () => {
    if (!whatsappForm.phone_number.trim()) {
      toast({
        title: "Erro",
        description: "Informe o número do WhatsApp",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      if (whatsappConfig) {
        // Update existing
        const { error } = await supabase
          .from("whatsapp_config")
          .update({
            phone_number: whatsappForm.phone_number,
            default_message: whatsappForm.default_message,
            is_active: whatsappForm.is_active,
          })
          .eq("id", whatsappConfig.id);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase.from("whatsapp_config").insert({
          phone_number: whatsappForm.phone_number,
          default_message: whatsappForm.default_message,
          is_active: whatsappForm.is_active,
        });

        if (error) throw error;
      }

      toast({
        title: "Sucesso",
        description: "Configurações do WhatsApp salvas com sucesso",
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar configurações",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenFaqDialog = (item?: FAQItem) => {
    if (item) {
      setEditingFaq(item);
      setFaqForm({ question: item.question, answer: item.answer });
    } else {
      setEditingFaq(null);
      setFaqForm({ question: "", answer: "" });
    }
    setFaqDialogOpen(true);
  };

  const handleSaveFaq = async () => {
    if (!faqForm.question.trim() || !faqForm.answer.trim()) {
      toast({
        title: "Erro",
        description: "Preencha a pergunta e a resposta",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      if (editingFaq) {
        // Update
        const { error } = await supabase
          .from("faq_items")
          .update({
            question: faqForm.question,
            answer: faqForm.answer,
          })
          .eq("id", editingFaq.id);

        if (error) throw error;
      } else {
        // Create - get next position
        const maxPosition = faqItems.length > 0 
          ? Math.max(...faqItems.map(i => i.position)) 
          : -1;

        const { error } = await supabase.from("faq_items").insert({
          question: faqForm.question,
          answer: faqForm.answer,
          position: maxPosition + 1,
        });

        if (error) throw error;
      }

      toast({
        title: "Sucesso",
        description: editingFaq ? "Pergunta atualizada" : "Pergunta adicionada",
      });

      setFaqDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFaq = async () => {
    if (!faqToDelete) return;

    setSaving(true);

    try {
      const { error } = await supabase
        .from("faq_items")
        .delete()
        .eq("id", faqToDelete.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Pergunta removida",
      });

      setFaqDeleteDialogOpen(false);
      setFaqToDelete(null);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao remover",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = faqItems.findIndex((item) => item.id === active.id);
      const newIndex = faqItems.findIndex((item) => item.id === over.id);

      const newItems = arrayMove(faqItems, oldIndex, newIndex);
      setFaqItems(newItems);

      // Update positions in database
      const updates = newItems.map((item, index) => ({
        id: item.id,
        position: index,
      }));

      for (const update of updates) {
        await supabase
          .from("faq_items")
          .update({ position: update.position })
          .eq("id", update.id);
      }
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">Configurações do Site</h1>

      <Tabs defaultValue="whatsapp" className="space-y-6">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="faq">FAQ</TabsTrigger>
          <TabsTrigger value="refund">Reembolso</TabsTrigger>
          <TabsTrigger value="categories">
            <Tag className="h-4 w-4 mr-1" />
            Categorias
          </TabsTrigger>
          <TabsTrigger value="fees">
            <DollarSign className="h-4 w-4 mr-1" />
            Taxas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-[#25D366]" />
                Botão Flutuante do WhatsApp
              </CardTitle>
              <CardDescription>
                Configure o botão de WhatsApp que aparece em todas as páginas do site
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="whatsapp-active">Botão ativo</Label>
                <Switch
                  id="whatsapp-active"
                  checked={whatsappForm.is_active}
                  onCheckedChange={(checked) =>
                    setWhatsappForm((prev) => ({ ...prev, is_active: checked }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Número do WhatsApp (com DDD e código do país)</Label>
                <Input
                  id="phone"
                  placeholder="5511999999999"
                  value={whatsappForm.phone_number}
                  onChange={(e) =>
                    setWhatsappForm((prev) => ({ ...prev, phone_number: e.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Exemplo: 5511999999999 (55 = Brasil, 11 = DDD, 999999999 = número)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Mensagem padrão</Label>
                <Textarea
                  id="message"
                  placeholder="Mensagem que será enviada automaticamente"
                  value={whatsappForm.default_message}
                  onChange={(e) =>
                    setWhatsappForm((prev) => ({ ...prev, default_message: e.target.value }))
                  }
                  rows={3}
                />
              </div>

              <Button onClick={handleSaveWhatsApp} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar configurações
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="faq">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Perguntas Frequentes (FAQ)</CardTitle>
                  <CardDescription>
                    Gerencie as perguntas e respostas exibidas na página inicial
                  </CardDescription>
                </div>
                <Button onClick={() => handleOpenFaqDialog()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {faqItems.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma pergunta cadastrada. Clique em "Adicionar" para criar.
                </p>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={faqItems.map((i) => i.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3">
                      {faqItems.map((item) => (
                        <SortableFAQItem
                          key={item.id}
                          item={item}
                          onEdit={handleOpenFaqDialog}
                          onDelete={(item) => {
                            setFaqToDelete(item);
                            setFaqDeleteDialogOpen(true);
                          }}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="refund">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Política de Cancelamento e Reembolso
              </CardTitle>
              <CardDescription>
                Configure o texto informativo sobre cancelamentos e reembolsos exibido na aba de ingressos dos usuários
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="refund-active">Exibir informativo</Label>
                <Switch
                  id="refund-active"
                  checked={refundForm.is_active}
                  onCheckedChange={(checked) =>
                    setRefundForm((prev) => ({ ...prev, is_active: checked }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="refund-text">Texto da política</Label>
                <Textarea
                  id="refund-text"
                  placeholder="Ex: Para solicitar reembolso, entre em contato pelo WhatsApp..."
                  value={refundForm.policy_text}
                  onChange={(e) =>
                    setRefundForm((prev) => ({ ...prev, policy_text: e.target.value }))
                  }
                  rows={4}
                />
              </div>

              <Button 
                onClick={async () => {
                  if (!refundForm.policy_text.trim()) {
                    toast({ title: "Erro", description: "Informe o texto da política", variant: "destructive" });
                    return;
                  }
                  setSaving(true);
                  try {
                    if (refundPolicy) {
                      await supabase.from("refund_policy_config").update({
                        policy_text: refundForm.policy_text,
                        is_active: refundForm.is_active,
                      }).eq("id", refundPolicy.id);
                    } else {
                      await supabase.from("refund_policy_config").insert({
                        policy_text: refundForm.policy_text,
                        is_active: refundForm.is_active,
                      });
                    }
                    toast({ title: "Sucesso", description: "Política de reembolso salva" });
                    fetchData();
                  } catch (error: any) {
                    toast({ title: "Erro", description: error.message, variant: "destructive" });
                  } finally {
                    setSaving(false);
                  }
                }} 
                disabled={saving}
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar política
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <CategoryManager />
        </TabsContent>

        <TabsContent value="fees">
          <FeeConfigTab />
        </TabsContent>
      </Tabs>

      {/* FAQ Dialog */}
      <Dialog open={faqDialogOpen} onOpenChange={setFaqDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingFaq ? "Editar pergunta" : "Nova pergunta"}
            </DialogTitle>
            <DialogDescription>
              Preencha a pergunta e a resposta para o FAQ
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="faq-question">Pergunta</Label>
              <Input
                id="faq-question"
                value={faqForm.question}
                onChange={(e) =>
                  setFaqForm((prev) => ({ ...prev, question: e.target.value }))
                }
                placeholder="Ex: Como compro ingressos?"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="faq-answer">Resposta</Label>
              <Textarea
                id="faq-answer"
                value={faqForm.answer}
                onChange={(e) =>
                  setFaqForm((prev) => ({ ...prev, answer: e.target.value }))
                }
                placeholder="Digite a resposta aqui..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFaqDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveFaq} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={faqDeleteDialogOpen} onOpenChange={setFaqDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover pergunta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A pergunta será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFaq} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SiteSettingsManagement;
