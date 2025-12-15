import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Trash2, Plus, GripVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ImageUpload } from "@/components/ImageUpload";
import { logActivity } from "@/hooks/useActivityLog";
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

interface Category {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  created_at: string;
  position: number | null;
}

export const CategoryManager = () => {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    image_url: "",
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("position", { ascending: true, nullsFirst: false })
        .order("name");

      if (error) throw error;
      setCategories(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar categorias",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        description: category.description || "",
        image_url: category.image_url || "",
      });
    } else {
      setEditingCategory(null);
      setFormData({ name: "", description: "", image_url: "" });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingCategory(null);
    setFormData({ name: "", description: "", image_url: "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, preencha o nome da categoria",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingCategory) {
        const { error } = await supabase
          .from("categories")
          .update({
            name: formData.name,
            description: formData.description || null,
            image_url: formData.image_url || null,
          })
          .eq("id", editingCategory.id);

        if (error) throw error;

        await logActivity({
          actionType: "update",
          entityType: "category",
          entityId: editingCategory.id,
          entityName: formData.name,
        });

        toast({
          title: "Categoria atualizada",
          description: "A categoria foi atualizada com sucesso",
        });
      } else {
        const { data, error } = await supabase.from("categories").insert({
          name: formData.name,
          description: formData.description || null,
          image_url: formData.image_url || null,
        }).select().single();

        if (error) throw error;

        await logActivity({
          actionType: "create",
          entityType: "category",
          entityId: data.id,
          entityName: formData.name,
        });

        toast({
          title: "Categoria criada",
          description: "A categoria foi criada com sucesso",
        });
      }

      fetchCategories();
      handleCloseDialog();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar categoria",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    const categoryToDelete = categories.find(c => c.id === id);
    if (!confirm("Tem certeza que deseja excluir esta categoria?")) return;

    try {
      const { error } = await supabase.from("categories").delete().eq("id", id);

      if (error) throw error;

      await logActivity({
        actionType: "delete",
        entityType: "category",
        entityId: id,
        entityName: categoryToDelete?.name || "Categoria",
      });

      toast({
        title: "Categoria excluída",
        description: "A categoria foi excluída com sucesso",
      });

      fetchCategories();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir categoria",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleImageUpload = (url: string) => {
    setFormData({ ...formData, image_url: url });
  };

  const handleImageRemove = () => {
    setFormData({ ...formData, image_url: "" });
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = categories.findIndex((cat) => cat.id === active.id);
      const newIndex = categories.findIndex((cat) => cat.id === over.id);

      const newCategories = arrayMove(categories, oldIndex, newIndex);
      setCategories(newCategories);

      // Update positions in database
      try {
        const updates = newCategories.map((cat, index) => ({
          id: cat.id,
          position: index + 1,
        }));

        for (const update of updates) {
          const { error } = await supabase
            .from("categories")
            .update({ position: update.position })
            .eq("id", update.id);

          if (error) throw error;
        }

        toast({
          title: "Ordem atualizada",
          description: "A ordem das categorias foi atualizada com sucesso",
        });
      } catch (error: any) {
        toast({
          title: "Erro ao atualizar ordem",
          description: error.message,
          variant: "destructive",
        });
        fetchCategories(); // Reload to get correct order
      }
    }
  };

  const SortableTableRow = ({ category }: { category: Category }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: category.id,
    });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <TableRow ref={setNodeRef} style={style}>
        <TableCell>
          <div className="flex items-center gap-2">
            <button
              className="cursor-grab active:cursor-grabbing touch-none"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </button>
            {category.image_url ? (
              <img
                src={category.image_url}
                alt={category.name}
                className="w-10 h-10 object-contain rounded"
              />
            ) : (
              <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                <span className="text-lg">{category.name[0]}</span>
              </div>
            )}
          </div>
        </TableCell>
        <TableCell className="font-medium">{category.name}</TableCell>
        <TableCell className="text-muted-foreground">
          {category.description || "-"}
        </TableCell>
        <TableCell className="text-right space-x-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleOpenDialog(category)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDelete(category.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </TableCell>
      </TableRow>
    );
  };

  if (loading) {
    return <div>Carregando categorias...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold">Gerenciar Categorias</h2>
        <Button onClick={() => handleOpenDialog()} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Nova Categoria
        </Button>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
        {categories.map((category) => (
          <Card key={category.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                {category.image_url ? (
                  <img
                    src={category.image_url}
                    alt={category.name}
                    className="w-12 h-12 object-contain rounded shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 bg-muted rounded flex items-center justify-center shrink-0">
                    <span className="text-xl">{category.name[0]}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base">{category.name}</CardTitle>
                  <CardDescription className="text-sm line-clamp-2">
                    {category.description || "Sem descrição"}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => handleOpenDialog(category)}
              >
                <Pencil className="h-4 w-4 mr-1" />
                Editar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="flex-1"
                onClick={() => handleDelete(category.id)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Excluir
              </Button>
            </CardContent>
          </Card>
        ))}
        {categories.length === 0 && (
          <div className="text-center py-12 text-muted-foreground border rounded-lg">
            Nenhuma categoria cadastrada
          </div>
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block border rounded-lg overflow-x-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ícone</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                {categories.map((category) => (
                  <SortableTableRow key={category.id} category={category} />
                ))}
              </SortableContext>
              {categories.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Nenhuma categoria cadastrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DndContext>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Editar Categoria" : "Nova Categoria"}
            </DialogTitle>
            <DialogDescription>
              {editingCategory
                ? "Atualize as informações da categoria"
                : "Preencha os dados da nova categoria"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Ex: Música, Esportes, Teatro"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Descrição opcional da categoria"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Ícone/Imagem</Label>
                <ImageUpload
                  currentImageUrl={formData.image_url}
                  onImageUploaded={handleImageUpload}
                  onImageRemoved={handleImageRemove}
                />
                <p className="text-sm text-muted-foreground">
                  Recomendado: ícone quadrado (ex: 64x64px)
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingCategory ? "Atualizar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
