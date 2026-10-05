import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

/**
 * Calls a Supabase edge function as the signed-in user and returns its JSON.
 * Throws an Error carrying the function's `{ error }` message on failure.
 */
export async function callFunction<T = unknown>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null);
      throw new Error(payload?.error || `Request failed (${error.context.status})`);
    }
    throw new Error(error.message || 'Request failed');
  }
  return data as T;
}