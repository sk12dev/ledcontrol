/**
 * Schedules re-execution of the same cue while a cue list stays on one position.
 * Cleared when the list steps to another cue (forward/back/go-to).
 */

import { cueExecutionService } from "./cueExecutionService.js";

const timersByCueList = new Map<number, NodeJS.Timeout[]>();

export function clearCueListRepeatTimers(cueListId: number): void {
  const list = timersByCueList.get(cueListId);
  if (!list?.length) {
    timersByCueList.delete(cueListId);
    return;
  }
  for (const t of list) {
    clearTimeout(t);
  }
  timersByCueList.delete(cueListId);
}

function pushTimer(cueListId: number, t: NodeJS.Timeout): void {
  const list = timersByCueList.get(cueListId) ?? [];
  list.push(t);
  timersByCueList.set(cueListId, list);
}

/**
 * After the initial executeCue for this list item, schedule further plays every
 * repeatIntervalSeconds until repeatTotalPlays is reached (or forever if null).
 */
export function scheduleCueRepeats(
  cueListId: number,
  cueId: number,
  fadeInSeconds: number,
  repeatIntervalSeconds: number,
  repeatTotalPlays: number | null
): void {
  clearCueListRepeatTimers(cueListId);

  if (repeatIntervalSeconds <= 0) {
    return;
  }

  let additionalPlays: number | null =
    repeatTotalPlays == null ? null : Math.max(0, repeatTotalPlays - 1);

  const scheduleNext = (): void => {
    if (additionalPlays === 0) {
      return;
    }

    const t = setTimeout(() => {
      try {
        cueExecutionService.prepareForNextCue();
      } catch {
        /* ignore */
      }
      cueExecutionService
        .executeCue(cueId, {
          transitionDurationSeconds:
            fadeInSeconds >= 0 ? fadeInSeconds : undefined,
        })
        .catch((err) => {
          console.error(
            `[CueListRepeat] Error re-executing cue ${cueId} on list ${cueListId}:`,
            err
          );
        });

      if (additionalPlays !== null) {
        additionalPlays -= 1;
      }
      if (additionalPlays === null || additionalPlays > 0) {
        scheduleNext();
      }
    }, repeatIntervalSeconds * 1000);

    pushTimer(cueListId, t);
  };

  scheduleNext();
}
