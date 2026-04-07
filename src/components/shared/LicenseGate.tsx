import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useLicenseStore, LicenseStatus } from "../../store/useLicenseStore";
import { KeyRound, AlertTriangle, Clock } from "lucide-react";

export function LicenseGate({ children }: { children: React.ReactNode }) {
  const { status, loading, setStatus, setLoading } = useLicenseStore();

  useEffect(() => {
    invoke<LicenseStatus>("check_license")
      .then(setStatus)
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-gray-400">
        Loading...
      </div>
    );
  }

  if (status && status.trial_expired && !status.is_licensed) {
    return <TrialExpiredScreen />;
  }

  return (
    <div className="flex flex-col h-full">
      {status && status.is_trial && <TrialBanner daysLeft={status.trial_days_remaining} />}
      {children}
    </div>
  );
}

function TrialBanner({ daysLeft }: { daysLeft: number }) {
  const [showActivate, setShowActivate] = useState(false);
  const urgent = daysLeft <= 3;

  return (
    <>
      <div
        className={`flex items-center justify-between px-4 py-1.5 text-xs ${
          urgent
            ? "bg-amber-900/60 text-amber-300"
            : "bg-blue-900/40 text-blue-300"
        }`}
      >
        <span className="flex items-center gap-1.5">
          <Clock size={12} />
          Trial: {daysLeft} day{daysLeft !== 1 ? "s" : ""} remaining
        </span>
        <button
          onClick={() => setShowActivate(true)}
          className="underline hover:no-underline"
        >
          Enter license key
        </button>
      </div>
      {showActivate && (
        <ActivateDialog onClose={() => setShowActivate(false)} />
      )}
    </>
  );
}

function TrialExpiredScreen() {
  const [showActivate, setShowActivate] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center h-full bg-gray-900 text-gray-100 gap-6">
      <AlertTriangle size={48} className="text-amber-500" />
      <h1 className="text-2xl font-bold">Trial Expired</h1>
      <p className="text-gray-400 text-center max-w-md">
        Your 10-day free trial has ended. Please purchase a license to continue
        using GNSS RTK Desktop.
      </p>
      <button
        onClick={() => setShowActivate(true)}
        className="bg-blue-600 hover:bg-blue-700 px-6 py-2.5 rounded-lg font-medium flex items-center gap-2"
      >
        <KeyRound size={18} />
        Enter License Key
      </button>
      {showActivate && (
        <ActivateDialog onClose={() => setShowActivate(false)} />
      )}
    </div>
  );
}

function ActivateDialog({ onClose }: { onClose: () => void }) {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [activating, setActivating] = useState(false);
  const setStatus = useLicenseStore((s) => s.setStatus);

  async function activate() {
    setError("");
    setActivating(true);
    try {
      const status = await invoke<LicenseStatus>("activate_license", { key: key.trim() });
      setStatus(status);
      onClose();
    } catch (e) {
      setError(String(e));
    }
    setActivating(false);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-96 space-y-4 shadow-2xl">
        <h2 className="text-lg font-semibold">Activate License</h2>
        <p className="text-sm text-gray-400">
          Enter your license key in the format: GNSS-XXXX-XXXX-XXXX-XXXX
        </p>
        <input
          value={key}
          onChange={(e) => setKey(e.target.value.toUpperCase())}
          placeholder="GNSS-XXXX-XXXX-XXXX-XXXX"
          className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm font-mono tracking-wider"
          maxLength={24}
        />
        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={activate}
            disabled={activating || key.length < 24}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
          >
            {activating ? "Activating..." : "Activate"}
          </button>
        </div>
      </div>
    </div>
  );
}
