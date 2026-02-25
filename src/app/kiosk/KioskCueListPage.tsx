import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog";
import { useCueLists } from "@/hooks/useCueLists";
import { useMultiDevice } from "@/hooks/useMultiDevice";
import { setState } from "@/api/wledClient";
import type { CueList } from "@/api/backendClient";

function getCueAtPosition(cueList: CueList, position: number) {
  if (!cueList.cueListCues?.length || position < 0 || position >= cueList.cueListCues.length)
    return null;
  const item = cueList.cueListCues[position];
  return item?.cue ?? null;
}

export default function KioskCueListPage() {
  const { showId: showIdParam, cueListId: cueListIdParam } = useParams<{
    showId: string;
    cueListId: string;
  }>();
  const navigate = useNavigate();
  const showId = showIdParam ? parseInt(showIdParam, 10) : undefined;
  const cueListId = cueListIdParam ? parseInt(cueListIdParam, 10) : undefined;

  const {
    cueLists,
    loading,
    error,
    stepForward,
    stepBackward,
  } = useCueLists(undefined, showId);

  const { getConnectedDevices, refreshDeviceStates } = useMultiDevice();

  const cueList = useMemo(() => {
    if (cueListId === undefined || !cueLists.length) return null;
    return cueLists.find((c) => c.id === cueListId) ?? null;
  }, [cueLists, cueListId]);

  const [stepping, setStepping] = useState(false);
  const [isBlackoutDialogOpen, setIsBlackoutDialogOpen] = useState(false);
  const [isBlackingOut, setIsBlackingOut] = useState(false);

  useEffect(() => {
    if (!loading && showId !== undefined && cueListId !== undefined) {
      if (isNaN(showId) || isNaN(cueListId) || !cueList) {
        navigate(`/kiosk/show/${showId}`, { replace: true });
      }
    }
  }, [loading, showId, cueListId, cueList, navigate]);

  const handlePrevious = async () => {
    if (!cueListId || stepping) return;
    setStepping(true);
    try {
      await stepBackward(cueListId);
    } catch (err) {
      console.error("Failed to step backward:", err);
    } finally {
      setStepping(false);
    }
  };

  const handleNext = async () => {
    if (!cueListId || stepping) return;
    setStepping(true);
    try {
      await stepForward(cueListId);
    } catch (err) {
      console.error("Failed to step forward:", err);
    } finally {
      setStepping(false);
    }
  };

  const handleBlackout = () => {
    const connectedDevices = getConnectedDevices();
    if (connectedDevices.length === 0) {
      alert("No connected devices to turn off.");
      return;
    }
    setIsBlackoutDialogOpen(true);
  };

  const confirmBlackout = async () => {
    setIsBlackingOut(true);
    const connectedDevices = getConnectedDevices();
    try {
      await Promise.all(
        connectedDevices.map(async (device) => {
          try {
            await setState(device.ipAddress, { on: false });
          } catch (error) {
            console.error(`Failed to turn off device ${device.name} (${device.ipAddress}):`, error);
          }
        })
      );
      setTimeout(() => refreshDeviceStates(), 500);
      setIsBlackoutDialogOpen(false);
    } catch (error) {
      console.error("Error during blackout:", error);
    } finally {
      setIsBlackingOut(false);
    }
  };

  const connectedCount = getConnectedDevices().length;

  if (!loading && showId !== undefined && cueListId !== undefined && !cueList) {
    return (
      <div className="kiosk min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <p className="text-zinc-400 text-lg">Cue list not found. Redirecting...</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="kiosk min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <p className="text-zinc-400 text-lg">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="kiosk min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4 text-lg">Error: {error}</p>
          <Button
            variant="outline"
            className="min-h-[48px] px-6 text-base"
            onClick={() => showId && navigate(`/kiosk/show/${showId}`)}
          >
            Back to cue lists
          </Button>
        </div>
      </div>
    );
  }

  const totalCues = cueList?.cueListCues?.length ?? 0;
  const currentPosition = cueList?.currentPosition ?? 0;
  const currentCue = cueList ? getCueAtPosition(cueList, currentPosition) : null;
  const previousCue = cueList && currentPosition > 0 ? getCueAtPosition(cueList, currentPosition - 1) : null;
  const nextCue = cueList && currentPosition < totalCues - 1 ? getCueAtPosition(cueList, currentPosition + 1) : null;
  const canGoBack = totalCues > 0 && currentPosition > 0;
  const canGoForward = totalCues > 0 && currentPosition < totalCues - 1;

  return (
    <div className="kiosk min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Header: Back to cue lists + Blackout */}
      <div className="border-b border-zinc-900 bg-zinc-950/95 backdrop-blur-sm shrink-0">
        <div className="container mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <Button
                variant="ghost"
                size="sm"
                className="text-zinc-400 hover:text-white min-h-[48px] min-w-[48px] px-4 text-base touch-manipulation shrink-0"
                onClick={() => showId !== undefined && navigate(`/kiosk/show/${showId}`)}
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to cue lists
              </Button>
              <div className="h-8 w-px bg-zinc-800 shrink-0" />
              <h1 className="font-semibold text-lg sm:text-xl text-white truncate">
                {cueList?.name ?? "Cue list"}
              </h1>
            </div>
            <Button
              className="bg-red-600 hover:bg-red-700 min-h-[48px] px-4 text-base touch-manipulation shrink-0"
              onClick={handleBlackout}
              disabled={connectedCount === 0 || isBlackingOut}
            >
              {isBlackingOut ? "Turning Off..." : "Blackout"}
            </Button>
          </div>
        </div>
      </div>

      {/* Blackout confirmation dialog */}
      <AlertDialog open={isBlackoutDialogOpen} onOpenChange={setIsBlackoutDialogOpen}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-600/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <AlertDialogTitle className="text-white">
                  Blackout
                </AlertDialogTitle>
                <AlertDialogDescription className="text-zinc-400 mt-1">
                  This will immediately power off all {connectedCount} connected lighting device{connectedCount !== 1 ? "s" : ""}.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel
              disabled={isBlackingOut}
              className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBlackout}
              disabled={isBlackingOut}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isBlackingOut ? "Turning Off..." : "Turn Off All Devices"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Main: Active cue badge + Back / Next buttons with cue names */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 py-8">
        {totalCues === 0 ? (
          <p className="text-zinc-400 text-lg">This cue list has no cues.</p>
        ) : (
          <>
            {/* Cue number: 1 of 4 */}
            <p className="text-zinc-400 text-base sm:text-lg">
              {currentPosition + 1} of {totalCues}
            </p>

            {/* Active cue - green pill like in reference */}
            <div className="rounded-xl bg-emerald-500 px-6 py-3 text-center w-full max-w-md">
              <span className="text-white font-bold text-lg sm:text-xl">
                Active: {currentCue?.name ?? "—"}
              </span>
            </div>

            {/* Back / Next - large touch targets with previous/next cue names */}
            <div className="flex items-center gap-4 sm:gap-8 w-full max-w-2xl justify-center flex-wrap">
              <Button
                size="lg"
                variant="outline"
                className="flex-1 min-h-[80px] min-w-[160px] border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800 touch-manipulation disabled:opacity-50 h-auto py-3"
                onClick={handlePrevious}
                disabled={!canGoBack || stepping}
              >
                <span className="flex flex-col items-center gap-1 text-center">
                  <span className="flex items-center text-base sm:text-lg font-medium">
                    <ChevronLeft className="w-5 h-5 mr-1 shrink-0" />
                    Back
                  </span>
                  {previousCue ? (
                    <span className="text-sm font-medium text-zinc-400 line-clamp-2 break-words w-full px-1">
                      {previousCue.name}
                    </span>
                  ) : (
                    <span className="text-sm text-zinc-500">—</span>
                  )}
                </span>
              </Button>
              <Button
                size="lg"
                className="flex-1 min-h-[80px] min-w-[160px] bg-emerald-600 hover:bg-emerald-700 touch-manipulation disabled:opacity-50 h-auto py-3"
                onClick={handleNext}
                disabled={!canGoForward || stepping}
              >
                <span className="flex flex-col items-center gap-1 text-center">
                  <span className="flex items-center text-base sm:text-lg font-medium">
                    Next
                    <ChevronRight className="w-5 h-5 ml-1 shrink-0" />
                  </span>
                  {nextCue ? (
                    <span className="text-sm font-medium text-white/90 line-clamp-2 break-words w-full px-1">
                      {nextCue.name}
                    </span>
                  ) : (
                    <span className="text-sm text-white/70">—</span>
                  )}
                </span>
              </Button>
            </div>
            {stepping && (
              <p className="text-zinc-500 text-sm">Updating...</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
