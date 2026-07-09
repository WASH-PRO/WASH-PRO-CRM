import { Component, type ErrorInfo, type ReactNode } from 'react';
import { isChunkLoadError } from '../utils/lazyPage';

interface Props {
  children: ReactNode;
  compact?: boolean;
}

interface State {
  error: Error | null;
}

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Route render error:', error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const chunkError = isChunkLoadError(error);
    const wrapperClass = this.props.compact
      ? 'flex min-h-[40vh] flex-col items-center justify-center gap-4 px-4 py-16 text-center'
      : 'flex min-h-screen flex-col items-center justify-center gap-4 bg-panel-canvas px-4 py-16 text-center dark:bg-panel-canvas-dark';

    return (
      <div className={wrapperClass}>
        <div className="max-w-md space-y-3">
          <h1 className="font-display text-xl font-semibold text-panel-ink dark:text-panel-ink-dark">
            {chunkError ? 'Не удалось загрузить страницу' : 'Ошибка интерфейса'}
          </h1>
          <p className="text-sm leading-relaxed text-panel-muted dark:text-panel-muted-dark">
            {chunkError
              ? 'Часто это происходит после обновления CRM, когда браузер держит старый кэш. Перезагрузка обычно помогает.'
              : error.message || 'Произошла непредвиденная ошибка при отображении раздела.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button type="button" className="btn-primary" onClick={this.handleReload}>
            Перезагрузить
          </button>
          {!chunkError && (
            <button type="button" className="btn-secondary" onClick={this.handleRetry}>
              Попробовать снова
            </button>
          )}
        </div>
      </div>
    );
  }
}
