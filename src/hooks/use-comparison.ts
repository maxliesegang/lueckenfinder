import { useCallback, useEffect, useRef, useState } from "react";
import {
  type ComparisonStage,
  compareDataset,
  createComparisonRequestCache,
} from "../comparison";
import { friendlyError } from "../error-message";
import { formatNumber, t, translateMessage } from "../i18n";
import type { ConflationResult, Dataset } from "../types";
import type { StatusController } from "./use-status";

export interface Comparison {
  result: ConflationResult | undefined;
  running: boolean;
  run: (dataset: Dataset, matchRadiusM: number) => Promise<void>;
  cancel: () => void;
  clear: () => void;
}

/**
 * Owns the lifecycle of a dataset comparison: request de-duplication, run
 * cancellation, progress reporting, and the resulting conflation. The map and
 * summary render from `result`; status text flows through the status controller.
 */
export function useComparison(status: StatusController): Comparison {
  const cache = useRef(createComparisonRequestCache()).current;
  const activeRun = useRef<AbortController | undefined>(undefined);
  const [result, setResult] = useState<ConflationResult | undefined>(undefined);
  const [running, setRunning] = useState(false);

  const cancel = useCallback(() => {
    activeRun.current?.abort();
    activeRun.current = undefined;
    setRunning(false);
  }, []);

  const clear = useCallback(() => {
    cancel();
    setResult(undefined);
  }, [cancel]);

  useEffect(() => () => activeRun.current?.abort(), []);

  const { setStatus, setStatusTimed } = status;

  const run = useCallback(
    async (dataset: Dataset, matchRadiusM: number) => {
      const controller = new AbortController();
      activeRun.current?.abort();
      activeRun.current = controller;
      setRunning(true);
      setResult(undefined);
      const startedAt = performance.now();

      try {
        const outcome = await compareDataset(dataset, matchRadiusM, {
          cache,
          signal: controller.signal,
          onStage: (stage) => reportStage(stage, setStatus),
        });
        if (controller.signal.aborted || activeRun.current !== controller) return;

        setResult(outcome.result);

        const featureCount = outcome.officialCount + outcome.result.onlyInOsm.length;
        const elapsedSeconds = formatNumber((performance.now() - startedAt) / 1_000, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        });
        const warning =
          outcome.warnings.length > 0
            ? ` ${t("status.warning", {
                message: outcome.warnings.map(translateMessage).join(" "),
              })}`
            : "";
        setStatusTimed(
          t("status.found", {
            count: formatNumber(featureCount),
            seconds: elapsedSeconds,
            warning,
          }),
          warning ? 8_000 : 3_000,
        );
      } catch (error) {
        if (!controller.signal.aborted) {
          setStatus(t("status.error", { message: friendlyError(error) }));
        }
      } finally {
        if (activeRun.current === controller) {
          activeRun.current = undefined;
          setRunning(false);
        }
      }
    },
    [cache, setStatus, setStatusTimed],
  );

  return { result, running, run, cancel, clear };
}

function reportStage(
  stage: ComparisonStage,
  setStatus: StatusController["setStatus"],
): void {
  switch (stage.type) {
    case "official":
      setStatus(t("status.loadingOfficial"), true);
      break;
    case "osm":
      setStatus(
        t("status.queryingOsm", { count: formatNumber(stage.officialCount) }),
        true,
      );
      break;
    case "broad-match":
      setStatus(t("status.checkingPartial"), true);
      break;
    case "conflate":
      setStatus(t("status.comparing"), true);
      break;
  }
}
