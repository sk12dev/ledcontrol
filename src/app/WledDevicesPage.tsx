import { useNavigate } from "react-router-dom";
import { ArrowLeft, Zap } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { MultiDeviceManager } from "@/components/MultiDeviceManager";
import { WledSegmentsManager } from "@/components/WledSegmentsManager";

export default function WledDevicesPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-900 bg-zinc-950/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                className="text-zinc-400 hover:text-white"
                onClick={() => navigate("/shows")}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Shows
              </Button>
              <div className="h-8 w-px bg-zinc-800" />
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-amber-600 to-amber-500 rounded-lg flex items-center justify-center">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="font-semibold text-lg">WLED Devices</h1>
                  <p className="text-xs text-zinc-500">Manage your WLED lighting devices</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-3xl space-y-8">
          <div>
            <p className="text-zinc-400 mb-6">
              Add, edit, and manage WLED devices. You can also add devices from the workspace when working on a show.
            </p>
            <MultiDeviceManager />
          </div>
          <div>
            <WledSegmentsManager />
          </div>
        </div>
      </div>
    </div>
  );
}
