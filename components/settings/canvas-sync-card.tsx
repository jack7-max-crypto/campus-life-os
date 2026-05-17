"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, MetricRow } from "@/components/ui/card";
import {
  clearCanvasImportSnapshot,
  persistCanvasSyncResult,
  setCanvasImportError,
  setCanvasImportSyncing,
  useCanvasImportSnapshot,
} from "@/lib/integrations/canvas/store";
import type {
  CanvasStatusResponse,
  CanvasSyncResult,
} from "@/lib/integrations/canvas/types";

const primaryButtonClassName =
  "system-button-primary px-4 py-2.5 text-sm font-semibold disabled:border-white/30 disabled:bg-white/30 disabled:text-white/50";
const secondaryButtonClassName =
  "system-button-secondary px-4 py-2.5 text-sm font-semibold";
const noteClassName =
  "system-inset-panel rounded-[16px] px-3 py-2 text-sm text-white/70";

type SyncResponsePayload = {
  result?: CanvasSyncResult;
  error?: string;
};

function formatTimestamp(value: string | null) {
  if (!value) {
    return "Not synced yet";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not synced yet";
  }

  return date.toLocaleString();
}

function getSearchNotice(canvasStatus: string | null, message: string | null) {
  if (canvasStatus === "connected") {
    return "Canvas OAuth connection completed. You can sync when ready.";
  }

  if (canvasStatus === "setup-required") {
    return "Canvas setup is incomplete. Add the required environment variables first.";
  }

  if (canvasStatus === "error") {
    return message ?? "Canvas connection could not be completed.";
  }

  return null;
}

function formatCanvasWarning(warning: string) {
  const normalized = warning.trim();

  if (!normalized) {
    return "Assignments could not be loaded for Unknown course.";
  }

  return normalized.replace(
    /Assignments could not be loaded for\s*\.$/i,
    "Assignments could not be loaded for Unknown course.",
  );
}

export function CanvasSyncCard() {
  const searchParams = useSearchParams();
  const { snapshot, hasHydrated } = useCanvasImportSnapshot();
  const [status, setStatus] = useState<CanvasStatusResponse | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const canvasStatus = searchParams.get("canvas");
    const message = searchParams.get("message");
    setNotice(getSearchNotice(canvasStatus, message));
  }, [searchParams]);

  useEffect(() => {
    let isCancelled = false;

    async function loadStatus() {
      setIsLoadingStatus(true);

      try {
        const response = await fetch("/api/canvas/status", {
          method: "GET",
          cache: "no-store",
        });
        const payload = (await response.json()) as CanvasStatusResponse;

        if (!isCancelled) {
          setStatus(payload);
        }
      } catch {
        if (!isCancelled) {
          setErrorMessage("Canvas status could not be loaded.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingStatus(false);
        }
      }
    }

    void loadStatus();

    return () => {
      isCancelled = true;
    };
  }, []);

  async function handleSync() {
    setIsSyncing(true);
    setErrorMessage(null);
    setNotice(null);
    setCanvasImportSyncing();

    try {
      const response = await fetch("/api/canvas/sync", {
        method: "POST",
      });
      const payload = (await response.json()) as SyncResponsePayload;

      if (!response.ok || !payload.result) {
        const message = payload.error ?? "Canvas sync failed.";
        setCanvasImportError(message);
        setErrorMessage(message);
        return;
      }

      persistCanvasSyncResult(payload.result);
      setNotice("Canvas data synced into the isolated import store.");

      const statusResponse = await fetch("/api/canvas/status", {
        method: "GET",
        cache: "no-store",
      });
      const statusPayload = (await statusResponse.json()) as CanvasStatusResponse;
      setStatus(statusPayload);
    } catch {
      const message = "Canvas sync failed.";
      setCanvasImportError(message);
      setErrorMessage(message);
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleDisconnect() {
    setErrorMessage(null);

    try {
      await fetch("/api/canvas/disconnect", {
        method: "POST",
      });

      clearCanvasImportSnapshot();
      setNotice("Canvas OAuth tokens were cleared. Imported Canvas data was removed locally.");

      const response = await fetch("/api/canvas/status", {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await response.json()) as CanvasStatusResponse;
      setStatus(payload);
    } catch {
      setErrorMessage("Canvas disconnect failed.");
    }
  }

  const statusLabel = isLoadingStatus
    ? "Checking"
    : status?.mode === "oauth" && status.isConnected
      ? "Connected"
      : status?.mode === "dev-token"
        ? "Dev token"
        : status?.oauthConfigured
          ? "Setup ready"
          : "Setup required";

  const lastSyncedLabel = hasHydrated ? formatTimestamp(snapshot.lastSyncedAt) : "Loading";

  return (
    <Card
      title="Canvas sync"
      subtitle="Read-only course and assignment import"
      variant="dark"
      className="md:col-span-2"
    >
      <div className="space-y-3">
        <p className="text-sm leading-6 text-white/65">
          {status?.setupMessage ??
            "Canvas stays isolated from manual Academics and Planner data until later integration is enabled."}
        </p>

        {notice ? (
          <div className="semantic-success rounded-xl px-3 py-2 text-sm">
            {notice}
          </div>
        ) : null}

        {errorMessage ? (
          <div className="semantic-danger rounded-xl px-3 py-2 text-sm">
            {errorMessage}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <MetricRow label="Connection" value={statusLabel} variant="dark" />
          <MetricRow label="Canvas host" value={status?.baseUrlHost ?? "Not configured"} variant="dark" />
          <MetricRow
            label="Courses imported"
            value={String(snapshot.counts.courses)}
            variant="dark"
          />
          <MetricRow
            label="Assignments imported"
            value={String(snapshot.counts.assignments)}
            variant="dark"
          />
          <MetricRow label="Last synced" value={lastSyncedLabel} variant="dark" />
          <MetricRow
            label="Planner-ready items"
            value={String(snapshot.counts.plannerItems)}
            variant="dark"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          {status?.oauthConfigured && status.mode !== "oauth" ? (
            <a href={status.connectUrl ?? "#"} className={primaryButtonClassName}>
              Connect Canvas
            </a>
          ) : null}

          <button
            type="button"
            onClick={() => void handleSync()}
            disabled={!status?.canSync || isSyncing}
            className={status?.oauthConfigured && status.mode !== "oauth" ? secondaryButtonClassName : primaryButtonClassName}
          >
            {isSyncing ? "Syncing..." : "Sync now"}
          </button>

          {status?.disconnectUrl ? (
            <button
              type="button"
              onClick={() => void handleDisconnect()}
              className={secondaryButtonClassName}
            >
              Disconnect
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => clearCanvasImportSnapshot()}
            className={secondaryButtonClassName}
          >
            Clear imported data
          </button>
        </div>

        <div className={noteClassName}>
          <p className="font-medium text-white">Server-side auth boundary</p>
          <p className="mt-1 text-white/65">
            Canvas secrets and OAuth tokens stay on the server. The browser only stores the
            normalized imported snapshot used for local read-only display.
          </p>
        </div>

        {!status?.isConfigured ? (
          <div className={noteClassName}>
            <p className="font-medium text-white">Setup required</p>
            <p className="mt-1 text-white/65">
              Add <code>CANVAS_BASE_URL</code>, <code>CANVAS_CLIENT_ID</code>,{" "}
              <code>CANVAS_CLIENT_SECRET</code>, and <code>CANVAS_REDIRECT_URI</code> for OAuth.
              For temporary development-only sync, you can also set <code>CANVAS_DEV_ACCESS_TOKEN</code>.
            </p>
          </div>
        ) : null}

        {snapshot.warnings.length > 0 ? (
          <div className={noteClassName}>
            <p className="font-medium text-white">Sync warnings</p>
            <ul className="mt-1 space-y-1 text-white/65">
              {snapshot.warnings.map((warning, index) => {
                const formattedWarning = formatCanvasWarning(warning);
                return (
                  <li key={`${formattedWarning}-${index}`}>{formattedWarning}</li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
