import { createSearchParamsCache, createSerializer, parseAsInteger, parseAsString } from "nuqs/server";
import { getSortingStateParser } from "./parsers";

export const searchParams = {
  page: parseAsInteger.withDefault(1),
  perPage: parseAsInteger.withDefault(10),
  name: parseAsString,
  is_active: parseAsString, // Filtro de estado en planes
  gender: parseAsString,
  category: parseAsString,
  first_name: parseAsString,
  last_name: parseAsString,
  full_name: parseAsString,
  email: parseAsString,
  phone: parseAsString,
  status: parseAsString,
  role: parseAsString,
  plan_name: parseAsString, // Filtro de plan
  user_name: parseAsString, // Filtro de cliente en pagos
  method: parseAsString, // Filtro de método de pago
  subscription_status: parseAsString, // Filtro de estado de suscripción en pagos
  payment_date: parseAsString, // Filtro de fecha
  sort: getSortingStateParser().withDefault([]), // Sorting
  // advanced filter
  // filters: getFiltersStateParser().withDefault([]),
  // joinOperator: parseAsStringEnum(['and', 'or']).withDefault('and')
};

export const searchParamsCache = createSearchParamsCache(searchParams);
export const serialize = createSerializer(searchParams);
