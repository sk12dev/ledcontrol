import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Plus, Edit2, Trash2, FolderOpen } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/app/components/ui/card";
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
import { useShows } from "../hooks/useShows";
import { ShowFormModal } from "./ShowFormModal";
import { type Show } from "../api/backendClient";

export function ShowList() {
  const navigate = useNavigate();
  const location = useLocation();
  const { shows, loading, error, createShow, updateShow, deleteShow, refreshShows } = useShows();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShow, setEditingShow] = useState<Show | null>(null);
  const [deleteShowId, setDeleteShowId] = useState<number | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const hasCheckedRedirect = useRef(false);

  // Check localStorage for selected show and redirect if valid
  // Only redirect on initial page load, not when user explicitly navigates here
  useEffect(() => {
    // Skip redirect if user explicitly navigated here from a show page
    const isExplicitNavigation = location.state?.from === "/show";
    
    if (!loading && shows.length > 0 && !hasCheckedRedirect.current && !isExplicitNavigation) {
      hasCheckedRedirect.current = true;
      const selectedShowId = localStorage.getItem("selectedShowId");
      if (selectedShowId) {
        const showId = parseInt(selectedShowId, 10);
        const show = shows.find(s => s.id === showId);
        if (show) {
          // Valid show found, redirect to it
          navigate(`/show/${showId}`, { replace: true });
          return;
        } else {
          // Show doesn't exist, clear localStorage
          localStorage.removeItem("selectedShowId");
        }
      }
    } else if (isExplicitNavigation) {
      // Reset the flag when explicitly navigating here so we can check again on refresh
      hasCheckedRedirect.current = false;
    }
  }, [loading, shows, navigate, location]);

  const handleCreateShow = () => {
    setEditingShow(null);
    setIsModalOpen(true);
  };

  const handleEditShow = (show: Show) => {
    setEditingShow(show);
    setIsModalOpen(true);
  };

  const handleDeleteShow = (showId: number) => {
    setDeleteShowId(showId);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteShow = async () => {
    if (deleteShowId === null) return;

    setIsDeleting(true);
    try {
      await deleteShow(deleteShowId);
      // Clear localStorage if the deleted show was the selected one
      const selectedShowId = localStorage.getItem("selectedShowId");
      if (selectedShowId && parseInt(selectedShowId, 10) === deleteShowId) {
        localStorage.removeItem("selectedShowId");
      }
      setIsDeleteDialogOpen(false);
      setDeleteShowId(null);
    } catch (err) {
      console.error("Failed to delete show:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSelectShow = (showId: number) => {
    // Save to localStorage
    localStorage.setItem("selectedShowId", showId.toString());
    // Navigate to show workspace
    navigate(`/show/${showId}`);
  };

  const handleSaveShow = async () => {
    await refreshShows();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400">Loading shows...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">Error: {error}</p>
          <Button onClick={refreshShows} variant="outline">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-900 bg-zinc-950/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-emerald-500 rounded-lg flex items-center justify-center">
                  <FolderOpen className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="font-semibold text-lg">LightControl Pro</h1>
                  <p className="text-xs text-zinc-500">Select a Show</p>
                </div>
              </div>
            </div>
            <Button
              onClick={handleCreateShow}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Show
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        {shows.length === 0 ? (
          <div className="text-center py-16">
            <div className="mb-6">
              <FolderOpen className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold mb-2">No shows yet</h2>
              <p className="text-zinc-400 mb-6">
                Create your first show to get started with lighting control.
              </p>
              <Button
                onClick={handleCreateShow}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Show
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {shows.map((show) => {
              const cueCount = show.cues?.length ?? 0;
              const cueListCount = show.cueLists?.length ?? 0;

              return (
                <Card
                  key={show.id}
                  className="bg-zinc-900/80 border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer group"
                  onClick={() => handleSelectShow(show.id)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-white mb-2">{show.name}</CardTitle>
                        {show.description && (
                          <CardDescription className="text-zinc-400">
                            {show.description}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-4 text-sm text-zinc-400">
                      <span>
                        {cueCount} cue{cueCount !== 1 ? "s" : ""}
                      </span>
                      <span>
                        {cueListCount} cue list{cueListCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </CardContent>
                  <CardFooter className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-zinc-700 text-zinc-400 hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditShow(show);
                      }}
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-zinc-700 text-red-400 hover:text-red-300 hover:border-red-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteShow(show.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Show Form Modal */}
      <ShowFormModal
        show={editingShow}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingShow(null);
        }}
        onSave={handleSaveShow}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              Delete Show
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              {deleteShowId !== null && (
                <>Are you sure you want to delete "{shows.find((s) => s.id === deleteShowId)?.name || "this show"}"? This action cannot be undone and will delete all cues and cue lists associated with this show.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setDeleteShowId(null);
              }}
              disabled={isDeleting}
              className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteShow}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
