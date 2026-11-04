import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoadingState } from '../../components/common/LoadingState';
import { useAppStore } from '../../store/appStore';

/** /requests/new: creates the Draft through the store, then replaces itself with that Draft’s Intake. */
export function NewRequestPage() {
  const createRequest = useAppStore((state) => state.createRequest);
  const navigate = useNavigate();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // StrictMode runs effects twice in development; create only one Draft.
    started.current = true;
    navigate(`/requests/${createRequest()}/intake`, { replace: true });
  }, [createRequest, navigate]);

  return <LoadingState label="Starting a new BOM Request…" />;
}
