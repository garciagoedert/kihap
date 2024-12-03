// Mock client temporário enquanto não configuramos o Supabase
export const supabase = {
  auth: {
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    onAuthStateChange: () => {
      const unsubscribe = () => {};
      return { data: { subscription: { unsubscribe } }, error: null };
    },
    signOut: () => Promise.resolve({ error: null })
  },
  from: (table: string) => ({
    select: () => ({
      eq: () => Promise.resolve({ data: [], error: null }),
      order: () => ({
        limit: () => Promise.resolve({ data: [], error: null })
      })
    }),
    insert: () => Promise.resolve({ data: null, error: null }),
    update: () => Promise.resolve({ data: null, error: null }),
    delete: () => Promise.resolve({ data: null, error: null })
  }),
  channel: (channel: string) => ({
    on: (event: string, config: any, callback: (payload: any) => void) => ({
      subscribe: () => {
        // Mock subscription que não faz nada
        console.log('Mock realtime subscription ativada');
        return Promise.resolve();
      }
    })
  })
};
