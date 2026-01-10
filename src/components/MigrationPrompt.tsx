/**
 * Migration Prompt Component
 * Prompts user to migrate localStorage data to backend on first load
 */

import { useState, useEffect } from "react";
import { needsMigration, migrateLocalStorageToBackend } from "../utils/migrateToBackend";

export function MigrationPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{
    devicesMigrated: number;
    presetsMigrated: number;
    errors: string[];
  } | null>(null);

  useEffect(() => {
    // Check if migration is needed
    if (needsMigration()) {
      setShowPrompt(true);
    }
  }, []);

  const handleMigrate = async () => {
    setIsMigrating(true);
    try {
      const result = await migrateLocalStorageToBackend();
      setMigrationResult(result);
      if (result.errors.length === 0) {
        // Hide prompt after successful migration
        setTimeout(() => {
          setShowPrompt(false);
        }, 3000);
      }
    } catch (error) {
      console.error("Migration failed:", error);
      setMigrationResult({
        devicesMigrated: 0,
        presetsMigrated: 0,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      });
    } finally {
      setIsMigrating(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
  };

  if (!showPrompt) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-semibold text-white mb-4">
          Migrate Data to Backend
        </h2>
        <p className="text-gray-300 mb-6">
          We found data in your browser's local storage. Would you like to migrate it to the backend database?
          This will make your data available across devices and browsers.
        </p>

        {migrationResult && (
          <div className="mb-4 p-3 bg-gray-700 rounded">
            <p className="text-sm text-gray-300 mb-2">
              <strong>Migration Complete:</strong>
            </p>
            <ul className="text-sm text-gray-400 space-y-1">
              <li>✅ Devices migrated: {migrationResult.devicesMigrated}</li>
              <li>✅ Presets migrated: {migrationResult.presetsMigrated}</li>
              {migrationResult.errors.length > 0 && (
                <li className="text-red-400">
                  ❌ Errors: {migrationResult.errors.length}
                </li>
              )}
            </ul>
            {migrationResult.errors.length > 0 && (
              <div className="mt-2 text-xs text-red-400">
                {migrationResult.errors.map((err, i) => (
                  <div key={i}>{err}</div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleMigrate}
            disabled={isMigrating || (migrationResult !== null && migrationResult.errors.length === 0)}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isMigrating ? "Migrating..." : migrationResult ? "Migrated!" : "Migrate Now"}
          </button>
          <button
            onClick={handleDismiss}
            disabled={isMigrating}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors disabled:opacity-50"
          >
            {migrationResult && migrationResult.errors.length === 0 ? "Close" : "Later"}
          </button>
        </div>
      </div>
    </div>
  );
}

