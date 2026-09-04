let lastNonAuthRoute: string | null = null;

/**
 * `usePathname()` grup adını kırptığı için sekme index'i "/" olarak gelir. Ama "/"
 * kök yönlendirme kapısıdır (app/index.tsx) ve oturumu olmayan kullanıcıyı açılış
 * sayfasına atar. Geri dönüş hedefi olarak kullanılabilmesi için grubu geri ekliyoruz.
 */
function normalizeRoute(route: string): string {
  const [path, query] = route.split('?');
  if (path === '' || path === '/') {
    return query ? `/(tabs)?${query}` : '/(tabs)';
  }
  return route;
}

export function setLastNonAuthRoute(route: string) {
  lastNonAuthRoute = normalizeRoute(route);
}

export function getLastNonAuthRoute() {
  return lastNonAuthRoute;
}
