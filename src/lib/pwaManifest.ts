/**
 * O Portal Assessora (/assessora) já é um PWA de verdade via vite-plugin-pwa, com manifest
 * próprio (dist/manifest.webmanifest) injetado automaticamente em TODO index.html — inclusive
 * nas páginas do supervisor/funcionário, já que é um app de página única.
 *
 * Pra deixar supervisor/funcionário também instaláveis (necessário pro push funcionar no
 * iPhone) sem tocar na configuração do vite-plugin-pwa, essa função troca o <link rel="manifest">
 * em tempo de execução: fora de /assessora, aponta pro manifest novo (app-manifest.webmanifest);
 * dentro de /assessora, não mexe em nada — o comportamento original continua intacto.
 */
export function setupPwaManifest() {
  if (typeof document === 'undefined') return;
  if (window.location.pathname.startsWith('/assessora')) return;

  document.querySelectorAll('link[rel="manifest"]').forEach(el => el.remove());
  const link = document.createElement('link');
  link.rel = 'manifest';
  link.href = '/app-manifest.webmanifest';
  document.head.appendChild(link);

  const setMeta = (name: string, content: string) => {
    let tag = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
    if (!tag) { tag = document.createElement('meta'); tag.setAttribute('name', name); document.head.appendChild(tag); }
    tag.setAttribute('content', content);
  };
  // Meta tags "clássicas" da Apple — o iOS usa isso (não só o manifest) pra reconhecer
  // o ícone/título quando "Adicionar à Tela de Início" e pra liberar push no app instalado.
  setMeta('apple-mobile-web-app-capable', 'yes');
  setMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');
  setMeta('apple-mobile-web-app-title', 'Rondello');

  let touchIcon = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement | null;
  if (!touchIcon) {
    touchIcon = document.createElement('link');
    touchIcon.rel = 'apple-touch-icon';
    document.head.appendChild(touchIcon);
  }
  touchIcon.href = '/pwa-192.png';
}
