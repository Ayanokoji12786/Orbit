import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, onSnapshot, query, setDoc, where } from '@react-native-firebase/firestore';

import { firestore } from '@/lib/firebase';
import { useAuthStore } from '@/stores/auth-store';
import type { Contact } from '@/types/domain';

export type AddContactResult = 'added' | 'not-found' | 'self' | 'exists';

/** This user's contacts (their own rolodex — adding someone doesn't require their consent). */
export function useContacts(): { contacts: Contact[]; loading: boolean } {
  const uid = useAuthStore((s) => s.uid);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firestore || !uid) {
      setContacts([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const itemsRef = collection(firestore, 'contacts', uid, 'items');
    const unsubscribe = onSnapshot(itemsRef, async (snap) => {
      const items = snap.docs.map((d) => ({ contactUid: d.id, isFavorite: Boolean(d.data().isFavorite) }));
      if (items.length === 0) {
        setContacts([]);
        setLoading(false);
        return;
      }

      const profiles = await Promise.all(
        items.map(async (item) => {
          const userSnap = await getDoc(doc(firestore!, 'users', item.contactUid));
          const data = userSnap.data();
          const contact: Contact = {
            id: item.contactUid,
            name: (data?.displayName as string | undefined) ?? 'Orbit User',
            avatarUrl: (data?.avatarUrl as string | null | undefined) ?? null,
            status: (data?.status as Contact['status'] | undefined) ?? 'offline',
            isFavorite: item.isFavorite,
          };
          return contact;
        }),
      );
      setContacts(profiles);
      setLoading(false);
    });

    return unsubscribe;
  }, [uid]);

  return { contacts, loading };
}

/** Looks a user up by email and adds them to the caller's contacts. */
export async function addContactByEmail(email: string): Promise<AddContactResult> {
  if (!firestore) throw new Error('Connect a Firebase project to add contacts.');
  const uid = useAuthStore.getState().uid;
  if (!uid) throw new Error('Sign in required.');

  const normalized = email.trim().toLowerCase();
  const usersSnap = await getDocs(query(collection(firestore, 'users'), where('email', '==', normalized)));
  if (usersSnap.empty) return 'not-found';

  const contactUid = usersSnap.docs[0].id;
  if (contactUid === uid) return 'self';

  const itemRef = doc(firestore, 'contacts', uid, 'items', contactUid);
  const existing = await getDoc(itemRef);
  if (existing.exists()) return 'exists';

  await setDoc(itemRef, { isFavorite: false, addedAt: new Date() });
  return 'added';
}

export async function setContactFavorite(contactUid: string, isFavorite: boolean) {
  if (!firestore) return;
  const uid = useAuthStore.getState().uid;
  if (!uid) return;
  await setDoc(doc(firestore, 'contacts', uid, 'items', contactUid), { isFavorite }, { merge: true });
}
