import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { useCueLists } from "@/hooks/useCueLists";
import type { CueList } from "@/api/backendClient";

function getCurrentCue(cueList: CueList) {
  if (!cueList.cueListCues?.length) return null;
  const item = cueList.cueListCues[cueList.currentPosition];
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

  const cueList = useMemo(() => {
    if (cueListId === undefined || !cueLists.length) return null;
    return cueLists.find((c) => c.id === cueListId) ?? null;
  }, [cueLists, cueListId]);

  const [stepping, setStepping] = useState(false);

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
  const currentCue = cueList ? getCurrentCue(cueList) : null;
  const canGoBack = totalCues > 0 && currentPosition > 0;
  const canGoForward = totalCues > 0 && currentPosition < totalCues - 1;

  return (
    <div className="kiosk min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Header: Back to cue lists */}
      <div className="border-b border-zinc-900 bg-zinc-950/95 backdrop-blur-sm shrink-0">
        <div className="container mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              className="text-zinc-400 hover:text-white min-h-[48px] min-w-[48px] px-4 text-base touch-manipulation"
              onClick={() => showId !== undefined && navigate(`/kiosk/show/${showId}`)}
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to cue lists
            </Button>
            <div className="h-8 w-px bg-zinc-800" />
            <h1 className="font-semibold text-lg sm:text-xl text-white truncate">
              {cueList?.name ?? "Cue list"}
            </h1>
          </div>
        </div>
      </div>

      {/* Main: Previous / Next + current cue info */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 py-8">
        {totalCues === 0 ? (
          <p className="text-zinc-400 text-lg">This cue list has no cues.</p>
        ) : (
          <>
            {/* Current cue feedback */}
            <div className="text-center min-h-[60px]">
              <p className="text-zinc-400 text-base sm:text-lg mb-1">
                Cue {currentPosition + 1} of {totalCues}
              </p>
              <p className="text-white text-xl sm:text-2xl font-medium">
                {currentCue?.name ?? "—"}
              </p>
            </div>

            {/* Prev / Next - large touch targets */}
            <div className="flex items-center gap-4 sm:gap-8 w-full max-w-md justify-center flex-wrap">
              <Button
                size="lg"
                variant="outline"
                className="flex-1 min-h-[56px] min-w-[140px] text-base sm:text-lg border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800 touch-manipulation disabled:opacity-50"
                onClick={handlePrevious}
                disabled={!canGoBack || stepping}
              >
                <ChevronLeft className="w-6 h-6 mr-2" />
                Previous cue
              </Button>
              <Button
                size="lg"
                className="flex-1 min-h-[56px] min-w-[140px] text-base sm:text-lg bg-emerald-600 hover:bg-emerald-700 touch-manipulation disabled:opacity-50"
                onClick={handleNext}
                disabled={!canGoForward || stepping}
              >
                Next cue
                <ChevronRight className="w-6 h-6 ml-2" />
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
