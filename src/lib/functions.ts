import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

/** A failed edge function call, carrying the HTTP status and the function's JSON body. */
export class FunctionCallError extends Error {
  constructor(message: string, public status: number | null, public payload: Record<string, unknown> | null) {
    super(message);
  }
}

// The business the user is working in. Set by LocationProvider and sent with every function
// call, so the server acts on that business (users can belong to several).
let activeOrganizationId: string | null = null;

export function setActiveOrganizationId(id: string | null) {
  activeOrganizationId = id;
}

/**
 * Calls a Supabase edge function as the signed-in user and returns its JSON.
 * Throws a FunctionCallError carrying the function's `{ error }` message on failure.
 */
export async function callFunction<T = unknown>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, {
    body,
    headers: activeOrganizationId ? { 'x-organization-id': activeOrganizationId } : undefined,
  });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null);
      throw new FunctionCallError(payload?.error || `Request failed (${error.context.status})`, error.context.status, payload);
    }
    throw new FunctionCallError(error.message || 'Request failed', null, null);
  }
  return data as T;
}
