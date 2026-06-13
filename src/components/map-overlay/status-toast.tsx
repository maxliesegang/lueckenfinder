import { KernLoader } from "@kern-ux-annex/kern-react-kit";
import type { Status } from "../../hooks/use-status";
import "./status-toast.css";

/**
 * Floating status pill anchored to the top of the map. Stays out of the way
 * until there is something to say (loading progress, errors, confirmations).
 */
export function StatusToast({ status }: { status: Status }) {
  if (!status.message && !status.loading) return null;

  return (
    <div className="status-toast" role="status" aria-live="polite">
      {status.loading && (
        <span className="status-toast__loader" aria-hidden="true">
          <KernLoader />
        </span>
      )}
      <span className="status-toast__message">{status.message}</span>
    </div>
  );
}
