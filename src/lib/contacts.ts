import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useLocationContext } from '@/context/LocationContext';

/** Customers saved for this business, mostly synced from a connected app (migration 026). */
export interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  tags: string[];
  source: 'app' | 'api';
}

/** Contacts that can be emailed (have an email and didn't opt out), for "Send to many". */
export function useEmailableContacts(enabled: boolean) {
  const { location } = useLocationContext();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !location) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from('contacts')
      .select('id, name, email, phone, tags, source')
      .eq('location_id', location.id)
      .eq('do_not_contact', false)
      .not('email', 'is', null)
      .order('name')
      .limit(1000)
      .then(({ data }) => {
        if (cancelled) return;
        setContacts((data as Contact[]) ?? []);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, location]);

  return { contacts, loading };
}

/** "Name, email" lines the customer-list parser understands. */
export function contactsToList(contacts: Contact[]) {
  return contacts.map((c) => `${c.name.replace(/[,;\t\r\n]+/g, ' ')}, ${c.email}`).join('\n');
}
