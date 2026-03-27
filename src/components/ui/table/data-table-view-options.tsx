'use client';

import type { Table } from '@tanstack/react-table';
import { Columns3, PinIcon, PinOffIcon, Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { CheckIcon, CaretSortIcon } from '@radix-ui/react-icons';

interface DataTableViewOptionsProps<TData> {
  table: Table<TData>;
}

export function DataTableViewOptions<TData>({
  table
}: DataTableViewOptionsProps<TData>) {
  const columns = React.useMemo(
    () =>
      table
        .getAllColumns()
        .filter(
          (column) =>
            typeof column.accessorFn !== 'undefined' && column.getCanHide()
        ),
    [table]
  );
  const pinnableColumns = React.useMemo(
    () =>
      table
        .getAllColumns()
        .filter(
          (column) =>
            typeof column.accessorFn !== 'undefined' &&
            column.getCanPin() &&
            column.getIsVisible()
        ),
    [table]
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          aria-label='Toggle columns'
          role='combobox'
          variant='outline'
          size='sm'
          className='ml-auto hidden h-8 lg:flex'
        >
          <Settings2 />
          View
          <CaretSortIcon className='ml-auto opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent align='end' className='w-64 p-0'>
        <Command>
          <CommandInput placeholder='Search columns...' />
          <CommandList>
            <CommandEmpty>No columns found.</CommandEmpty>
            <CommandGroup heading='Columnas'>
              {columns.map((column) => (
                <CommandItem
                  key={column.id}
                  onSelect={() =>
                    column.toggleVisibility(!column.getIsVisible())
                  }
                >
                  <span className='truncate'>
                    {column.columnDef.meta?.label ?? column.id}
                  </span>
                  <CheckIcon
                    className={cn(
                      'ml-auto size-4 shrink-0',
                      column.getIsVisible() ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading='Fijar columnas'>
              {pinnableColumns.map((column) => {
                const isPinned = column.getIsPinned() === 'left';

                return (
                  <CommandItem
                    key={`${column.id}-pin`}
                    onSelect={() => column.pin(isPinned ? false : 'left')}
                  >
                    <div className='flex items-center gap-2 truncate'>
                      {isPinned ? (
                        <PinOffIcon className='size-4 shrink-0 text-muted-foreground' />
                      ) : (
                        <PinIcon className='size-4 shrink-0 text-muted-foreground' />
                      )}
                      <div className='flex flex-col'>
                        <span className='truncate'>
                          {column.columnDef.meta?.label ?? column.id}
                        </span>
                        <span className='text-xs text-muted-foreground'>
                          {isPinned ? 'Quitar fijación' : 'Fijar a la izquierda'}
                        </span>
                      </div>
                    </div>
                    <Columns3
                      className={cn(
                        'ml-auto size-4 shrink-0',
                        isPinned ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
