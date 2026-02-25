import { useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Zap, ArrowLeft } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { useShows } from "@/hooks/useShows";
import { useCueLists } from "@/hooks/useCueLists";
import type { CueList } from "@/api/backendClient";

export default function KioskCueListsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const showId = id ? parseInt(id, 10) : undefined;

  const { shows, loading: showsLoading } = useShows();
  const { cueLists, loading: cueListsLoading } = useCueLists(undefined, showId);

  const currentShow = useMemo(() => {
    return showId !== undefined ? shows.find((s) => s.id === showId) : null;
  }, [shows, showId]);

  useEffect(() => {
    if (!showsLoading && showId !== undefined) {
      if (isNaN(showId) || !currentShow) {
        navigate("/kiosk", { replace: true });
      }
    }
  }, [showsLoading, showId, currentShow, navigate]);

  const handleSelectCueList = (cueListId: number) => {
    if (showId !== undefined) {
      navigate(`/kiosk/show/${showId}/cue-list/${cueListId}`);
    }
  };

  if (!showsLoading && showId !== undefined && !currentShow) {
    return (
      <div className="kiosk min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <p className="text-zinc-400 text-lg">Show not found. Redirecting...</p>
      </div>
    );
  }

  const loading = showsLoading || cueListsLoading;

  return (
    <div className="kiosk min-h-screen bg-zinc-950 text-white">
      {/* Header: Back to shows + show name */}
      <div className="border-b border-zinc-900 bg-zinc-950/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              className="bg-zinc-800 text-white hover:bg-zinc-700 hover:text-white min-h-[48px] min-w-[48px] px-4 text-base touch-manipulation"
              onClick={() => navigate("/kiosk")}
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to shows
            </Button>
            <div className="h-8 w-px bg-zinc-800" />
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-emerald-500 rounded-lg flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-lg sm:text-xl text-white">
                  {currentShow?.name ?? "Loading..."}
                </h1>
                <p className="text-xs text-zinc-500">Select a cue list</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main: cue list cards */}
      <div className="container mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <p className="text-zinc-400 text-lg">Loading cue lists...</p>
        ) : cueLists.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-zinc-400 text-lg">No cue lists for this show.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {cueLists.map((cueList: CueList) => (
              <Card
                key={cueList.id}
                className="bg-zinc-900/80 border-zinc-800 border-2 active:border-emerald-500 transition-all cursor-pointer min-h-[120px] flex flex-col justify-center touch-manipulation"
                onClick={() => handleSelectCueList(cueList.id)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-lg sm:text-xl">
                    {cueList.name}
                  </CardTitle>
                  {cueList.description && (
                    <CardDescription className="text-zinc-400 text-sm line-clamp-2">
                      {cueList.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-zinc-400">
                    {cueList.cueListCues?.length ?? 0} cue
                    {(cueList.cueListCues?.length ?? 0) !== 1 ? "s" : ""}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
