'use client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { useCurrentUser } from '@/features/profile/hooks/use-profile';
import { clearPwaCaches } from "@/lib/pwa/client-cache";
import { IconUser, IconSettings, IconLogout } from '@tabler/icons-react';

export function UserNav() {
  const router = useRouter();
  const { data: user, isPending } = useCurrentUser();

  const handleSignOut = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
    );
    await clearPwaCaches();
    await supabase.auth.signOut();
    router.push('/iniciar-sesion');
  };

  // Loading state
  if (isPending) {
    return (
      <Button variant='ghost' className='relative h-8 w-8 rounded-full'>
        <Skeleton className='h-8 w-8 rounded-full' />
      </Button>
    );
  }

  // Get initials for avatar fallback
  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' className='relative h-8 w-8 rounded-full'>
          <Avatar className='h-8 w-8'>
            <AvatarImage src={user?.avatar_url || ''} alt={user?.full_name || 'Usuario'} />
            <AvatarFallback className='bg-primary/10 text-primary font-medium'>
              {getInitials(user?.full_name)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className='w-56'
        align='end'
        sideOffset={10}
        forceMount
      >
        <DropdownMenuLabel className='font-normal'>
          <div className='flex flex-col space-y-1'>
            <p className='text-sm leading-none font-medium'>
              {user?.full_name || 'Usuario'}
            </p>
            <p className='text-muted-foreground text-xs leading-none'>
              {user?.email || ''}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push('/panel/perfil')}>
            <IconUser className='mr-2 h-4 w-4' />
            Mi Perfil
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push('/panel/perfil')}>
            <IconSettings className='mr-2 h-4 w-4' />
            Configuración
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className='text-red-600 focus:text-red-600'>
          <IconLogout className='mr-2 h-4 w-4' />
          Cerrar Sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
