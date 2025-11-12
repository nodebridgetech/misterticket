-- Add auto_advance_batches column to events table
ALTER TABLE public.events 
ADD COLUMN auto_advance_batches boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.events.auto_advance_batches IS 'Quando verdadeiro, ao esgotar um lote de um setor, o próximo lote do mesmo setor com a data mais próxima ficará disponível automaticamente';