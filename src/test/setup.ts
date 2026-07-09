function createStorage(): Storage {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      store.set(key, String(value))
    },
  }
}

function installDomStorage(name: 'localStorage' | 'sessionStorage') {
  if (typeof globalThis[name]?.getItem === 'function' && typeof window[name]?.getItem === 'function') {
    return
  }

  const storage = createStorage()

  Object.defineProperty(globalThis, name, {
    value: storage,
    configurable: true,
  })
  Object.defineProperty(window, name, {
    value: storage,
    configurable: true,
  })
}

installDomStorage('localStorage')
installDomStorage('sessionStorage')

Object.defineProperty(window, 'scrollTo', {
  value: () => {},
  configurable: true,
})
