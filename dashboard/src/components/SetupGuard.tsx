import { ReactNode } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSetupStatus } from '../hooks/useSetupStatus';
import { getViewerSetupAck, getWelcomeSeen } from '../utils/setupStorage';
import { canManageSystemSetup } from '../utils/setupPermissions';
import { Loading } from './UI';

export function SetupGuard({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { loading: setupLoading, settings } = useSetupStatus();

  if (authLoading || setupLoading || !user) {
    return <Loading />;
  }

  const forceRestart =
    searchParams.get('restart') === '1' && canManageSystemSetup(user.permissions);
  const viewerAcked = getViewerSetupAck(user.id);
  const welcomeSeen = getWelcomeSeen(user.id);
  const canManage = canManageSystemSetup(user.permissions);

  const needsSetup =
    forceRestart ||
    (!settings.complete && (canManage || !viewerAcked));

  if (needsSetup) {
    const target = forceRestart ? '/setup?restart=1' : '/setup';
    if (location.pathname !== '/setup') {
      return <Navigate to={target} replace />;
    }
  }

  if (settings.complete && !welcomeSeen && location.pathname !== '/welcome' && location.pathname !== '/setup') {
    return <Navigate to="/welcome" replace />;
  }

  return <>{children}</>;
}
