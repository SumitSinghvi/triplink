// Stand-in for next/headers cookies(). Use with:
//   vi.doMock('next/headers', () => ({ cookies: async () => jar }));
export const jar = {
  store: new Map<string, string>(),
  get(name: string) {
    const value = this.store.get(name);
    return value === undefined ? undefined : { name, value };
  },
  set(name: string, value: string) {
    this.store.set(name, value);
  },
  delete(name: string) {
    this.store.delete(name);
  },
};
