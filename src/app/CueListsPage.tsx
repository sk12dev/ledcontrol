import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Plus, Settings, Zap, ArrowLeft } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Sheet, SheetContent } from "@/app/components/ui/sheet";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import { useShows } from "@/hooks/useShows";
import { useCueLists } from "@/hooks/useCueLists";
import { CueLists } from "@/components/CueLists";
import { CueListBuilder } from "@/components/CueListBuilder";
import type {
  CueList,
  CreateCueListRequest,
  UpdateCueListRequest,
} from "@/api/backendClient";

export default function CueListsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const showId = id ? parseInt(id, 10) : undefined;

  const [isCueListSheetOpen, setIsCueListSheetOpen] = useState(false);
  const [editingCueList, setEditingCueList] = useState<CueList | null>(null);

  const { shows, loading: showsLoading } = useShows();
  const { cueLists, createCueList, updateCueList } = useCueLists(
    undefined,
    showId
  );

  const currentShow = useMemo(() => {
    return showId ? shows.find((s) => s.id === showId) : null;
  }, [shows, showId]);

  useEffect(() => {
    if (!showsLoading && showId !== undefined) {
      if (isNaN(showId) || !currentShow) {
        navigate("/shows", { replace: true });
      } else {
        localStorage.setItem("selectedShowId", showId.toString());
      }
    }
  }, [showsLoading, showId, currentShow, navigate]);

  const handleNewCueList = () => {
    setEditingCueList(null);
    setIsCueListSheetOpen(true);
  };

  const handleEditCueList = (cueListId: number) => {
    const list = cueLists.find((cl) => cl.id === cueListId);
    if (list) {
      setEditingCueList(list);
      setIsCueListSheetOpen(true);
    }
  };

  const handleSaveCueList = async (
    cueListData: CreateCueListRequest | UpdateCueListRequest
  ) => {
    try {
      if (editingCueList) {
        await updateCueList(
          editingCueList.id,
          cueListData as UpdateCueListRequest
        );
      } else {
        await createCueList(cueListData as CreateCueListRequest);
      }
      setIsCueListSheetOpen(false);
      setEditingCueList(null);
    } catch (err) {
      console.error("Failed to save cue list:", err);
      throw err;
    }
  };

  const handleCancelCueList = () => {
    setIsCueListSheetOpen(false);
    setEditingCueList(null);
  };

  if (!showsLoading && showId !== undefined && !currentShow) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400">Show not found. Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white dark">
      {/* Header */}
      <div className="border-b border-zinc-900 bg-zinc-950/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                className="text-zinc-400 hover:text-white"
                onClick={() => navigate("/shows", { state: { from: "/show" } })}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Shows
              </Button>
              <div className="h-8 w-px bg-zinc-800" />
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-emerald-500 rounded-lg flex items-center justify-center">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="font-semibold text-lg">
                    {currentShow?.name || "Loading..."}
                  </h1>
                  <p className="text-xs text-zinc-500">Theatre Lighting System</p>
                </div>
              </div>
              <div className="h-8 w-px bg-zinc-800" />
              <nav className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-zinc-400 hover:text-white"
                  onClick={() => navigate(`/show/${showId}`)}
                >
                  Workspace
                </Button>
                <span className="text-zinc-600 px-1">|</span>
                <span className="text-white font-medium text-sm px-2">
                  Cue Lists
                </span>
              </nav>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-zinc-400 hover:text-white"
              >
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-zinc-400">
            Order cues for the show and step through during playback.
          </p>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={handleNewCueList}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Cue List
          </Button>
        </div>
        <CueLists showId={showId} onEdit={handleEditCueList} />
      </div>

      {/* Cue List Sheet */}
      <Sheet
        open={isCueListSheetOpen}
        onOpenChange={(open) => {
          setIsCueListSheetOpen(open);
          if (!open) setEditingCueList(null);
        }}
      >
        <SheetContent
          side="right"
          className="w-[50vw] min-w-[50vw] max-w-[50vw] sm:w-[50vw] sm:min-w-[50vw] sm:max-w-[50vw] bg-zinc-900 border-zinc-800 p-0 flex flex-col"
          style={{
            height: "100vh",
            maxHeight: "100vh",
            minHeight: "100vh",
            top: 0,
            bottom: 0,
          }}
        >
          <ScrollArea
            className="flex-1 min-h-0"
            style={{
              height: "100%",
              flex: "1 1 0%",
            }}
          >
            <div className="p-6">
              <CueListBuilder
                cueList={editingCueList ?? undefined}
                showId={currentShow?.id}
                onSave={handleSaveCueList}
                onCancel={handleCancelCueList}
              />
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
