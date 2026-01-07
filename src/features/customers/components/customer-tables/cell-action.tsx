'use client';
import { AlertModal } from '@/components/modal/alert-modal';
import { Button } from '@/components/ui/button';
import { Customer } from './columns';
import { IconEdit, IconTrash, IconLoader2, IconHistory } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';
import { CustomerFormSheet, CustomerData } from '../customer-form-sheet';
import { deleteCustomer } from '../../actions/customer-actions';
import { toast } from 'sonner';
import { useCustomer } from '../../hooks/use-customers';

interface CellActionProps {
  data: Customer;
}

export const CellAction: React.FC<CellActionProps> = ({ data }) => {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false); // Modal de borrado
  const [editOpen, setEditOpen] = useState(false); // Sheet de edición
  const router = useRouter();

  // Fetch automático cuando se abre el modal
  const { data: customerDetails, isLoading: isLoadingDetails } = useCustomer(editOpen ? data.id : null);

  // Combinar datos locales de la tabla con datos detallados del servidor si existen
  const customerToEdit = customerDetails ? {
      ...customerDetails,
      full_name: customerDetails.full_name || data.full_name,
      email: customerDetails.email || data.email,
      phone: customerDetails.phone || data.phone
  } as CustomerData : null;

  const onConfirm = async () => {
    setLoading(true);
    try {
      const result = await deleteCustomer(data.id);
      if (result.success) {
        toast.success('Cliente eliminado exitosamente');
        router.refresh();
      } else {
        toast.error('Error al eliminar el cliente');
      }
    } catch (error) {
      toast.error('Error al eliminar el cliente');
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  return (
    <>
      <AlertModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={onConfirm}
        loading={loading}
      />
      
      <CustomerFormSheet 
        mode="edit" 
        customer={customerToEdit}
        open={editOpen}
        onOpenChange={setEditOpen}
        trigger={null}
      />

      <div className='flex items-center gap-2'>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant='ghost'
                size='icon'
                className='h-8 w-8 hover:bg-muted'
                onClick={(e) => {
                  e.stopPropagation();
                  setEditOpen(true);
                }}
                disabled={editOpen && isLoadingDetails}
              >
                {editOpen && isLoadingDetails ? (
                  <IconLoader2 className='h-4 w-4 animate-spin text-blue-500' />
                ) : (
                  <IconEdit className='h-4 w-4 text-blue-500' />
                )}
                <span className='sr-only'>Editar cliente</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Editar cliente</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant='ghost'
                size='icon'
                className='h-8 w-8 hover:bg-muted'
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/dashboard/customers/${data.id}/history`);
                }}
              >
                <IconHistory className='h-4 w-4 text-orange-500' />
                <span className='sr-only'>Ver historial</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Historial del cliente</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider> */}

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant='ghost'
                size='icon'
                className='h-8 w-8 hover:bg-destructive/10'
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(true);
                }}
              >
                <IconTrash className='h-4 w-4 text-destructive' />
                <span className='sr-only'>Eliminar cliente</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Eliminar cliente</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </>
  );
};
