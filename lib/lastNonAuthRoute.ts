let lastNonAuthRoute: string | null = null;

export function setLastNonAuthRoute(route: string) {
  lastNonAuthRoute = route;
}

export function getLastNonAuthRoute() {
  return lastNonAuthRoute;
}

