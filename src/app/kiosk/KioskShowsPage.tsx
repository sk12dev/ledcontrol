import { useNavigate } from "react-router-dom";
import { FolderOpen } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { useShows } from "@/hooks/useShows";

export default function KioskShowsPage() {
  const navigate = useNavigate();
  const { shows, loading, error, refreshShows } = useShows();

  const handleSelectShow = (showId: number) => {
    navigate(`/kiosk/show/${showId}`);
  };

  if (loading) {
    return (
      <div className="kiosk min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <p className="text-zinc-400 text-lg">Loading shows...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="kiosk min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4 text-lg">Error: {error}</p>
          <Button
            onClick={refreshShows}
            variant="outline"
            className="min-h-[48px] min-w-[48px] px-6 text-base"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="kiosk min-h-screen bg-zinc-950 text-white">
      {/* Header - no Create Show */}
      <div className="border-b border-zinc-900 bg-zinc-950/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-emerald-500 rounded-lg flex items-center justify-center">
                <FolderOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-lg sm:text-xl">Kiosk – Select a Show</h1>
                <p className="text-xs text-zinc-500">Touch a show to open its cue lists</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - touch-friendly cards */}
      <div className="container mx-auto px-4 sm:px-6 py-6">
        {shows.length === 0 ? (
          <div className="text-center py-16">
            <FolderOpen className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
            <h2 className="text-xl sm:text-2xl font-semibold mb-2">No shows</h2>
            <p className="text-zinc-400 text-base">No shows available in kiosk mode.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {shows.map((show) => {
              const cueCount = show.cues?.length ?? 0;
              const cueListCount = show.cueLists?.length ?? 0;
              return (
                <Card
                  key={show.id}
                  className="bg-zinc-900/80 border-zinc-800 border-2 active:border-emerald-500 transition-all cursor-pointer min-h-[120px] flex flex-col justify-center touch-manipulation"
                  onClick={() => handleSelectShow(show.id)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-white text-lg sm:text-xl">
                      {show.name}
                    </CardTitle>
                    {show.description && (
                      <CardDescription className="text-zinc-400 text-sm line-clamp-2">
                        {show.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex gap-4 text-sm text-zinc-400">
                      <span>{cueCount} cue{cueCount !== 1 ? "s" : ""}</span>
                      <span>
                        {cueListCount} cue list{cueListCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
