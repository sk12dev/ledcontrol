/**
 * Migration utility to move data from localStorage to backend API
 * Run this once to migrate existing localStorage data to the database
 */

import { devicesApi, presetsApi } from "../api/backendClient";

/**
 * Migrates localStorage data to the backend database
 */
export async function migrateLocalStorageToBackend(): Promise<{
  devicesMigrated: number;
  presetsMigrated: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let devicesMigrated = 0;
  let presetsMigrated = 0;

  try {
    // Migrate IP address to device
    const storedIP = localStorage.getItem("wled_ip_address");
    if (storedIP && storedIP.trim() !== "") {
      try {
        // Check if device already exists
        const existingDevices = await devicesApi.getAll();
        const deviceExists = existingDevices.some((d) => d.ipAddress === storedIP);

        if (!deviceExists) {
          await devicesApi.create({
            name: `WLED ${storedIP}`,
            ipAddress: storedIP.trim(),
          });
          devicesMigrated++;
          console.log(`✅ Migrated device with IP: ${storedIP}`);
        } else {
          console.log(`ℹ️  Device with IP ${storedIP} already exists, skipping`);
        }
      } catch (error) {
        const errorMsg = `Failed to migrate device IP ${storedIP}: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }

    // Migrate presets
    const storedPresets = localStorage.getItem("wled_custom_presets");
    if (storedPresets) {
      try {
        const presets = JSON.parse(storedPresets) as Array<{
          id?: string;
          name: string;
          color: [number, number, number, number];
          brightness: number;
          createdAt?: number;
          deviceId?: number;
        }>;

        // Get existing presets to avoid duplicates
        const existingPresets = await presetsApi.getAll();
        const existingPresetNames = new Set(existingPresets.map((p) => p.name.toLowerCase()));

        for (const preset of presets) {
          try {
            // Validate preset structure
            if (
              !preset.name ||
              !Array.isArray(preset.color) ||
              preset.color.length !== 4 ||
              typeof preset.brightness !== "number" ||
              preset.brightness < 1 ||
              preset.brightness > 255
            ) {
              console.warn(`⚠️  Skipping invalid preset: ${preset.name || "unnamed"}`);
              continue;
            }

            // Skip if preset with same name already exists
            if (existingPresetNames.has(preset.name.toLowerCase())) {
              console.log(`ℹ️  Preset "${preset.name}" already exists, skipping`);
              continue;
            }

            await presetsApi.create({
              name: preset.name,
              color: preset.color,
              brightness: preset.brightness,
              deviceId: preset.deviceId,
            });

            presetsMigrated++;
            console.log(`✅ Migrated preset: ${preset.name}`);
          } catch (error) {
            const errorMsg = `Failed to migrate preset "${preset.name}": ${error instanceof Error ? error.message : String(error)}`;
            errors.push(errorMsg);
            console.error(`❌ ${errorMsg}`);
          }
        }
      } catch (error) {
        const errorMsg = `Failed to parse presets from localStorage: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }

    console.log("\n📊 Migration Summary:");
    console.log(`   Devices migrated: ${devicesMigrated}`);
    console.log(`   Presets migrated: ${presetsMigrated}`);
    console.log(`   Errors: ${errors.length}`);

    if (errors.length > 0) {
      console.log("\n❌ Errors encountered:");
      errors.forEach((err) => console.log(`   - ${err}`));
    }

    // Optionally clear localStorage after successful migration
    // Uncomment the following lines if you want to clear localStorage after migration:
    /*
    if (errors.length === 0) {
      console.log("\n🧹 Clearing localStorage...");
      localStorage.removeItem("wled_ip_address");
      localStorage.removeItem("wled_custom_presets");
      console.log("✅ localStorage cleared");
    }
    */
  } catch (error) {
    const errorMsg = `Migration failed: ${error instanceof Error ? error.message : String(error)}`;
    errors.push(errorMsg);
    console.error(`❌ ${errorMsg}`);
  }

  return {
    devicesMigrated,
    presetsMigrated,
    errors,
  };
}

/**
 * Check if migration is needed (checks if localStorage has data)
 */
export function needsMigration(): boolean {
  const hasIP = !!localStorage.getItem("wled_ip_address");
  const hasPresets = !!localStorage.getItem("wled_custom_presets");
  return hasIP || hasPresets;
}

