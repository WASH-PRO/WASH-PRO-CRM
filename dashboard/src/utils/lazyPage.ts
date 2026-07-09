import { lazy, type ComponentType } from 'react';

const CHUNK_RELOAD_KEY = 'wash_crm_chunk_reload';

function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk \d+ failed|error loading dynamically imported module/i.test(
    message
  );
}

async function importWithRetry<T extends Record<string, ComponentType>>(
  loader: () => Promise<T>,
  name: keyof T,
  retries = 2
): Promise<{ default: ComponentType }> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const module = await loader();
      const component = module[name];
      if (!component) {
        throw new Error(`Экспорт «${String(name)}» не найден в модуле страницы`);
      }
      sessionStorage.removeItem(CHUNK_RELOAD_KEY);
      return { default: component };
    } catch (error) {
      lastError = error;
      if (isChunkLoadError(error)) {
        const reloadKey = `${CHUNK_RELOAD_KEY}:${window.location.pathname}`;
        if (!sessionStorage.getItem(reloadKey) && attempt === retries) {
          sessionStorage.setItem(reloadKey, '1');
          window.location.reload();
          await new Promise(() => {});
        }
      }
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

export function lazyPage<T extends Record<string, ComponentType>>(loader: () => Promise<T>, name: keyof T) {
  return lazy(() => importWithRetry(loader, name));
}

export { isChunkLoadError };
