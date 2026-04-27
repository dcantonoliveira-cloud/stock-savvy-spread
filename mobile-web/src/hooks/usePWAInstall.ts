import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function detectIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iP(hone|ad|od)/.test(navigator.userAgent);
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  // iOS standalone property
  if ((window.navigator as { standalone?: boolean }).standalone === true) return true;
  // Standard display-mode check (Chrome/Android)
  return window.matchMedia('(display-mode: standalone)').matches;
}

export function usePWAInstall() {
  const [prompt, setPrompt]           = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled]     = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  const isIOS        = detectIOS();
  const isStandalone = detectStandalone();

  useEffect(() => {
    if (isStandalone) { setInstalled(true); return; }

    // iOS Safari never fires beforeinstallprompt — handled via guide instead
    if (isIOS) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    const installedHandler = () => setInstalled(true);

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, [isIOS, isStandalone]);

  const install = async () => {
    // On iOS: show step-by-step guide
    if (isIOS && !isStandalone) {
      setShowIOSGuide(true);
      return;
    }
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setPrompt(null);
  };

  // canInstall: show button on iOS (not standalone) OR on Android (prompt available)
  const canInstall = !installed && !isStandalone && (isIOS || !!prompt);

  return { canInstall, install, installed, showIOSGuide, setShowIOSGuide, isIOS };
}
