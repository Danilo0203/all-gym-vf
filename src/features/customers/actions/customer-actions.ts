'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!;

export interface CreateCustomerData {
  // Auth
  email: string;
  password?: string;
  // Profile
  full_name: string;
  phone: string;
  birth_date?: Date;
  gender: 'male' | 'female' | 'other';
  emergency_contact?: string;
  emergency_phone?: string;
  // Subscription
  plan_id: number;
  final_price?: number;
  discount_amount?: number;
  payment_method?: 'cash' | 'card' | 'transfer';
  start_date?: Date;
  end_date?: Date;
  // Body Assessment
  weight_kg?: number;
  height_cm?: number;
  injuries?: string;
  body_type?: string;
}

export async function createCustomer(data: CreateCustomerData) {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/create-customer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        email: data.email,
        password: data.password || undefined,
        full_name: data.full_name,
        phone: data.phone,
        birth_date: data.birth_date ? data.birth_date.toISOString().split('T')[0] : null,
        gender: data.gender,
        plan_id: data.plan_id,
        final_price: data.final_price,
        discount_amount: data.discount_amount || 0,
        payment_method: data.payment_method || 'cash',
        start_date: data.start_date ? data.start_date.toISOString().split('T')[0] : null,
        end_date: data.end_date ? data.end_date.toISOString().split('T')[0] : null,
        weight_kg: data.weight_kg || null,
        height_cm: data.height_cm || null,
        injuries: data.injuries || null,
        body_type: data.body_type || null,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Error from Edge Function:', result);
      return { success: false, error: result.error || 'Error al crear cliente' };
    }

    revalidatePath('/dashboard/customers');
    revalidatePath('/dashboard/overview');
    return { success: true, data: result };
  } catch (error) {
    console.error('Error creating customer:', error);
    return { success: false, error: 'Error de conexión' };
  }
}

export async function getPlans() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('plans')
    .select('id, name, price, duration_days')
    .eq('is_active', true)
    .order('price');
  
  if (error) {
    console.error('Error fetching plans:', error);
    return [];
  }
  return data || [];
}

export async function getCustomerById(id: string) {
  const supabase = await createClient();
  
  // Intentar obtener desde la vista customer_overview que ya sabemos que funciona para la lista
  const { data: customerView, error: viewError } = await supabase
    .from('customer_overview')
    .select('*')
    .eq('id', id)
    .single();

  console.log('Customer View Data:', customerView);
  
  if (viewError) {
    console.error('Error fetching customer view:', viewError);
    // Fallback a profiles si falla la vista
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', id).single();
    return profile;
  }
  
  // Obtener los datos físicos más recientes
  const { data: bodyAssessment } = await supabase
    .from('body_assessments')
    .select('*')
    .eq('user_id', id)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle(); // Usar maybeSingle por si no hay registros
  
  // Si la vista no tiene plan_id pero tiene plan_name, necesitamos obtener el ID del plan
  let planId = customerView.plan_id;
  
  if (!planId && customerView.plan_name) {
    console.log(`Searching plan by name: "${customerView.plan_name}"`);
    const { data: plan } = await supabase
      .from('plans')
      .select('id')
      .ilike('name', customerView.plan_name)
      .single();
      
    if (plan) {
        console.log(`Plan found via name lookup: ${plan.id}`);
        planId = plan.id;
    } else {
        console.log('Plan NOT found by name');
        // Intento con búsqueda parcial si falla la exacta
        const { data: planPartial } = await supabase
            .from('plans')
            .select('id')
            .ilike('name', `%${customerView.plan_name}%`)
            .limit(1)
            .single();
            
            if (planPartial) {
            console.log(`Plan found via partial lookup: ${planPartial.id}`);
            planId = planPartial.id;
        } else {
            // Último recurso: traer todos los planes y buscar en memoria
            console.log('Plan NOT found via partial lookup. Trying in-memory search...');
            const { data: allPlans } = await supabase.from('plans').select('id, name');
            if (allPlans) {
                const match = allPlans.find(p => 
                    p.name.toLowerCase().includes(customerView.plan_name.toLowerCase()) || 
                    customerView.plan_name.toLowerCase().includes(p.name.toLowerCase())
                );
                if (match) {
                    console.log(`Plan found via in-memory search: ${match.name} (${match.id})`);
                    planId = match.id;
                } else {
                    console.log('Plan NOT found in-memory.');
                }
            }
        }
    }
  }

  // Fetch subscription for editing: prioritize ACTIVE, fallback to most recent
  // First try to get active subscription
  let latestSubscription = null;
  
  const { data: activeSubscription } = await supabase
    .from('subscriptions')
    .select('*, plans(id, name)')
    .eq('user_id', id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (activeSubscription) {
    latestSubscription = activeSubscription;
  } else {
    // No active subscription, get most recent (expired)
    const { data: recentSubscription } = await supabase
      .from('subscriptions')
      .select('*, plans(id, name)')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    latestSubscription = recentSubscription;
  }
  
  // Fetch profile data
  const { data: profileData } = await supabase
    .from('profiles')
    .select('birth_date, injuries, gender')
    .eq('id', id)
    .maybeSingle();

  // Fetch Payment Method from latest subscription
  let paymentMethod = customerView.payment_method;
  
  if (latestSubscription) {
      const { data: lastPayment } = await supabase
        .from('payments')
        .select('method')
        .eq('subscription_id', latestSubscription.id)
        .maybeSingle();
      
      if (lastPayment) {
          paymentMethod = lastPayment.method;
      }
  }

  // Determine Plan ID from latest subscription (authoritative) or fallback to View
  // IMPORTANTE: Si updatedCustomerView tiene un plan_id pero latestSubscription no (null),
  // puede que sea un plan \"legacy\" o inconsistencia. Priorizamos latestSubscription si existe.
  let finalPlanId = latestSubscription?.plan_id;
  if (!finalPlanId && customerView.plan_id) finalPlanId = customerView.plan_id; 
  if (!finalPlanId && planId) finalPlanId = planId; // Fallback from expensive search logic if needed
  
  // Mapear los datos de la vista a lo que espera el formulario
  return {
    ...customerView, // Tiene full_name, email, phone, etc.
    birth_date: profileData?.birth_date || customerView.birth_date || null,
    gender: profileData?.gender || customerView.gender || null,
    injuries: profileData?.injuries || null,
    
    // Datos de suscripción REFRESCADOS desde la tabla real
    plan_id: finalPlanId || null,
    payment_method: paymentMethod || 'cash',
    
    // Usar fechas de la suscripción más reciente si existe, sino fallback a vista
    subscription_start_date: latestSubscription?.start_date || customerView.subscription_start_date || customerView.start_date || null,
    subscription_end_date: latestSubscription?.end_date || customerView.subscription_end_date || customerView.end_date || null,
    
    // Descuento aplicado (de la suscripción más reciente)
    discount_amount: latestSubscription?.discount_amount ?? 0,
    
    // Datos físicos
    weight_kg: bodyAssessment?.weight_kg || null,
    height_cm: bodyAssessment?.height_cm || null,
    body_type: bodyAssessment?.body_type || null,
    body_assessment_id: bodyAssessment?.id || null,
  };
}

// Helper para formatear Date a YYYY-MM-DD usando tiempo local (evita cambios por UTC)
function formatToLocalISO(date: Date | undefined | null): string | undefined | null {
  if (date === null) return null;
  if (date === undefined) return undefined;
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return undefined;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function updateCustomer(id: string, data: Partial<CreateCustomerData>, accessToken?: string) {
  const supabase = await createClient();
  
  console.log(`Updating customer ${id}`, data);

  try {
    // 0. Actualizar contraseña si se proporciona
    if (data.password && data.password.length >= 6) {
      console.log(`Updating password for user ${id}`);
      
      if (!accessToken) {
        console.error('No access token provided for password update');
        return { success: false, error: 'No hay sesión activa. Por favor, inicia sesión nuevamente.' };
      }

      try {
        const passwordResponse = await fetch(`${SUPABASE_URL}/functions/v1/update-customer-password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            user_id: id,
            new_password: data.password,
          }),
        });

        // Handle non-JSON responses (like 404)
        const contentType = passwordResponse.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.error('Password update failed - Edge Function may not be deployed. Status:', passwordResponse.status);
          return { 
            success: false, 
            error: `Error: La función de cambio de contraseña no está disponible (Status: ${passwordResponse.status}). Despliega la Edge Function 'update-customer-password'.` 
          };
        }

        const passwordResult = await passwordResponse.json();

        if (!passwordResponse.ok) {
          console.error('Error updating password:', passwordResult);
          return { success: false, error: `Error al cambiar contraseña: ${passwordResult.error || passwordResult.message || 'Error desconocido'}` };
        }
        
        console.log('Password updated successfully');
      } catch (fetchError) {
        console.error('Fetch error updating password:', fetchError);
        return { success: false, error: 'Error de conexión al actualizar contraseña' };
      }
    }

    // 1. Actualizar el perfil
    const profileUpdate: any = {
      updated_at: new Date().toISOString(),
    };

    if (data.full_name !== undefined) profileUpdate.full_name = data.full_name;
    if (data.phone !== undefined) profileUpdate.phone = data.phone;
    if (data.birth_date !== undefined) profileUpdate.birth_date = formatToLocalISO(data.birth_date);
    if (data.gender !== undefined) profileUpdate.gender = data.gender;
    if (data.injuries !== undefined) profileUpdate.injuries = data.injuries || null;

    const { error: profileError } = await supabase
      .from('profiles')
      .update(profileUpdate)
      .eq('id', id);
      
    if (profileError) {
      console.error('Error updating profile:', profileError);
      return { success: false, error: `Error perfil: ${profileError.message}` };
    }

    // 2. Gestión de Suscripción
    console.log('Plan ID received:', data.plan_id, 'Type:', typeof data.plan_id);
    
    // Verificar que plan_id sea un número válido mayor a 0
    const validPlanId = typeof data.plan_id === 'number' && data.plan_id > 0;
    
    if (validPlanId) {
       // Buscar la suscripción MÁS RECIENTE (activa o expirada) para actualizarla
       // Prioriza las activas, pero si no hay, usa la expirada más reciente
       const { data: currentSubscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', id)
        .in('status', ['active', 'expired']) // Incluir ambos estados
        .order('status', { ascending: true }) // 'active' viene primero
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
        
       // Columnas de la tabla subscriptions: user_id, plan_id, start_date, end_date, status, discount_amount
       const newSubscriptionData = {
        user_id: id,
        plan_id: data.plan_id,
        start_date: formatToLocalISO(data.start_date),
        end_date: formatToLocalISO(data.end_date),
        discount_amount: data.discount_amount || 0,
        status: 'active', // Siempre guardar como active al editar
       };

       if (!currentSubscription) {
          console.log('No active subscription found. Creating new one.');
          const { error: insertError } = await supabase
            .from('subscriptions')
            .insert(newSubscriptionData);
          if (insertError) console.error('Error creating subscription:', insertError);

       } else {
          console.log(`Updating existing subscription ${currentSubscription.id} with new details (Plan: ${data.plan_id})`);
          
          // ACTUALIZAR la suscripción existente, incluso si cambia el plan
          const { error: updateError } = await supabase
            .from('subscriptions')
            .update({
                plan_id: data.plan_id, // Actualizar el plan
                start_date: newSubscriptionData.start_date,
                end_date: newSubscriptionData.end_date,
                discount_amount: newSubscriptionData.discount_amount,
                status: 'active', // Reactivar si estaba expirada
            })
            .eq('id', currentSubscription.id);
            
          if (updateError) {
             console.error('Error updating existing subscription:', updateError);
          } else {
             // 2.1 Actualizar también el registro de PAGO asociado para mantener la consistencia financiera
             // Obtener el precio del nuevo plan
             const { data: planData } = await supabase
               .from('plans')
               .select('price')
               .eq('id', data.plan_id)
               .single();

             if (planData) {
               const newOriginalAmount = Number(planData.price);
               const newDiscount = Number(newSubscriptionData.discount_amount);
               const newFinalAmount = newOriginalAmount - newDiscount;

               console.log(`Syncing payment data for subscription ${currentSubscription.id}: Original=${newOriginalAmount}, Discount=${newDiscount}, Final=${newFinalAmount}`);

               const paymentUpdateData: any = {
                 amount_original: newOriginalAmount,
                 discount_amount: newDiscount,
                 amount_paid: newFinalAmount,
               };

               if (data.payment_method) {
                 paymentUpdateData.method = data.payment_method;
               }

               // Actualizar la fecha del pago con la fecha de inicio de la suscripción
               if (data.start_date) {
                 paymentUpdateData.payment_date = new Date(data.start_date).toISOString();
               }

               const { error: paymentError } = await supabase
                 .from('payments')
                 .update(paymentUpdateData)
                 .eq('subscription_id', currentSubscription.id);

               if (paymentError) console.error('Error syncing payment data:', paymentError);
             }
          }
       }
    }
    
    // 3. Body Assessment
    if (data.weight_kg !== undefined || data.height_cm !== undefined || data.body_type !== undefined) {
       console.log('Updating body assessment for customer', id, {
         weight_kg: data.weight_kg,
         height_cm: data.height_cm,
         body_type: data.body_type
       });

       const { data: existingAssessment, error: fetchAssessError } = await supabase
        .from('body_assessments')
        .select('id')
        .eq('user_id', id)
        .order('date', { ascending: false }) // Cambiado de created_at a date
        .limit(1)
        .maybeSingle();

       if (fetchAssessError) {
         console.error('Error fetching existing assessment:', fetchAssessError);
       }

       const assessmentData: any = {
        user_id: id,
       };
       if (data.weight_kg !== undefined) assessmentData.weight_kg = data.weight_kg;
       if (data.height_cm !== undefined) assessmentData.height_cm = data.height_cm;
       if (data.body_type !== undefined) assessmentData.body_type = data.body_type;

       if (existingAssessment) {
          console.log('Updating existing assessment', existingAssessment.id);
          const { error: assessError } = await supabase
            .from('body_assessments')
            .update(assessmentData)
            .eq('id', existingAssessment.id);
          if (assessError) console.error('Error updating assessment:', assessError);
       } else {
          console.log('Creating new assessment');
          const { error: assessError } = await supabase
            .from('body_assessments')
            .insert({ ...assessmentData, date: new Date().toISOString().split('T')[0] });
          if (assessError) console.error('Error creating assessment:', assessError);
       }
    }

    console.log('Update sequence completed successfully for', id);
    revalidatePath('/dashboard/customers');
    revalidatePath(`/dashboard/customers/${id}`);
    revalidatePath('/dashboard/overview');
    
    return { success: true };
  } catch (error) {
    console.error('CRITICAL: Exception in updateCustomer action:', error);
    return { success: false, error: 'Excepción al actualizar. Revisa los logs.' };
  }
}

export interface RenewSubscriptionData {
  plan_id: number;
  start_date: Date;
  end_date: Date;
  price: number;
  discount_amount: number;
  amount_paid: number;
  payment_method: 'cash' | 'card' | 'transfer';
  // Physical Assessment
  weight_kg?: number;
  height_cm?: number;
  body_type?: string;
  injuries?: string;
}

export async function renewSubscription(customerId: string, data: RenewSubscriptionData) {
  const supabase = await createClient();
  console.log(`Renewing subscription for customer ${customerId}`, data);

  try {
    // 1. Archivar TODAS las suscripciones activas anteriores
    const { error: archiveError } = await supabase
      .from('subscriptions')
      .update({ status: 'inactive' })
      .eq('user_id', customerId)
      .eq('status', 'active');

    if (archiveError) {
      console.error('Error archiving previous subscriptions:', archiveError);
      return { success: false, error: 'Error archivando suscripción anterior' };
    }

    // 2. Crear NUEVA suscripción
    const { data: newSubscription, error: subError } = await supabase
      .from('subscriptions')
      .insert({
        user_id: customerId,
        plan_id: data.plan_id,
        start_date: formatToLocalISO(data.start_date),
        end_date: formatToLocalISO(data.end_date),
        status: 'active',
        discount_amount: data.discount_amount
      })
      .select()
      .single();

    if (subError || !newSubscription) {
      console.error('Error creating new subscription:', subError);
      return { success: false, error: 'Error creando nueva suscripción' };
    }

    // 3. Registrar el PAGO
    const { error: payError } = await supabase
      .from('payments')
      .insert({
        subscription_id: newSubscription.id,
        user_id: customerId,
        amount_original: data.price,
        discount_amount: data.discount_amount,
        amount_paid: data.amount_paid,
        method: data.payment_method,
        payment_date: new Date().toISOString()
      });

    if (payError) {
      console.error('Error recording payment:', payError);
      // No revertimos todo, pero logueamos el error grave
    }

    // 4. Registrar FICHA FÍSICA (Siempre, para continuidad)
    // Usamos los datos nuevos o buscamos los últimos si no se enviaron (aunque el modal debería enviarlos)
    const assessmentData: any = {
      user_id: customerId,
      date: new Date().toISOString().split('T')[0], // FECHA DE HOY
    };

    if (data.weight_kg) assessmentData.weight_kg = data.weight_kg;
    if (data.height_cm) assessmentData.height_cm = data.height_cm;
    if (data.body_type) assessmentData.body_type = data.body_type;
    if (data.injuries) assessmentData.injuries = data.injuries;

    const { error: assessError } = await supabase
      .from('body_assessments')
      .insert(assessmentData);

    if (assessError) {
      console.error('Error creating renewal assessment:', assessError);
    }

    revalidatePath('/dashboard/customers');
    revalidatePath(`/dashboard/customers/${customerId}`);
    revalidatePath('/dashboard/overview');
    
    return { success: true };

  } catch (error) {
    console.error('Exception in renewSubscription:', error);
    return { success: false, error: 'Error inesperado al renovar' };
  }
}

export async function deleteCustomer(id: string) {
  // TODO: Implement delete via Edge Function (needs to delete from auth.users as well)
  revalidatePath('/dashboard/customers');
  return { success: true };
}
