import { useCues } from "../hooks/useCues";
import { executionApi } from "../api/backendClient";

interface CueExecutorProps {
  cueId: number | null;
}

export function CueExecutor({ cueId }: CueExecutorProps) {
  const { executionStatus, stopExecution, fetchExecutionStatus } = useCues();

  const handleStop = async () => {
    try {
      await stopExecution();
    } catch (error) {
      console.error("Failed to stop execution:", error);
    }
  };

  if (!executionStatus || !executionStatus.isRunning) {
    return null;
  }

  const elapsedSeconds = executionStatus.startTime
    ? Math.floor((Date.now() - executionStatus.startTime) / 1000)
    : 0;

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-green-500">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-green-400">Execution in Progress</h3>
        <button
          onClick={handleStop}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white"
        >
          Stop
        </button>
      </div>

      <div className="space-y-2">
        <div>
          <span className="text-gray-400">Cue ID:</span>{" "}
          <span className="text-white">{executionStatus.cueId}</span>
        </div>
        <div>
          <span className="text-gray-400">Current Step:</span>{" "}
          <span className="text-white">
            {executionStatus.currentStep !== null
              ? `${executionStatus.currentStep} / ${executionStatus.totalSteps}`
              : "N/A"}
          </span>
        </div>
        <div>
          <span className="text-gray-400">Elapsed Time:</span>{" "}
          <span className="text-white">{elapsedSeconds}s</span>
        </div>
        {executionStatus.startTime && (
          <div>
            <span className="text-gray-400">Started:</span>{" "}
            <span className="text-white">
              {new Date(executionStatus.startTime).toLocaleTimeString()}
            </span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {executionStatus.totalSteps > 0 && (
        <div className="mt-4">
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-green-600 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${
                  executionStatus.currentStep !== null
                    ? (executionStatus.currentStep / executionStatus.totalSteps) * 100
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

