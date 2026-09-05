const values = new Map<string, string>();

const AsyncStorage = {
  getItem: async (key: string): Promise<string | null> => values.get(key) ?? null,
  setItem: async (key: string, value: string): Promise<void> => {
    values.set(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    values.delete(key);
  },
  clear: async (): Promise<void> => {
    values.clear();
  },
};

export default AsyncStorage;
