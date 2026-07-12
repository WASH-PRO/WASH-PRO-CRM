import { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { moduleUiUrl } from '../api/modules';

const MIN_HEIGHT = 280;
const MAX_HEIGHT = 3200;

export function ModuleSettingsFrame({ moduleId }: { moduleId: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(MIN_HEIGHT);
  const { theme } = useTheme();

  const postTheme = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'wash-module-theme', theme }, '*');
  }, [theme]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'wash-module-resize') return;
      const next = Number(event.data.height);
      if (!Number.isFinite(next) || next <= 0) return;
      setHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.ceil(next))));
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    postTheme();
  }, [postTheme, moduleId]);

  return (
    <iframe
      ref={iframeRef}
      title={moduleId}
      src={`${moduleUiUrl(moduleId)}?embed=1`}
      onLoad={postTheme}
      style={{ height: `${height}px` }}
      className="block w-full overflow-hidden rounded-panel border border-panel-border bg-panel-card shadow-panel transition-[height] duration-200 dark:border-panel-border-dark dark:bg-panel-card-dark dark:shadow-none"
      sandbox="allow-scripts allow-same-origin allow-forms"
    />
  );
}
