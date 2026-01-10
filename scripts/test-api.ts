/**
 * Script to test all backend API endpoints
 * Run with: npx tsx scripts/test-api.ts
 */

import { devicesApi, presetsApi } from "../src/api/backendClient";

const API_BASE = "http://localhost:3001/api";

async function testHealth() {
  console.log("\n🏥 Testing Health Endpoint...");
  try {
    const response = await fetch(`${API_BASE.replace("/api", "")}/health`);
    const data = await response.json();
    console.log("✅ Health check:", data);
    return true;
  } catch (error) {
    console.error("❌ Health check failed:", error);
    return false;
  }
}

async function testDevices() {
  console.log("\n📱 Testing Devices API...");

  try {
    // Create a test device
    console.log("  Creating test device...");
    const newDevice = await devicesApi.create({
      name: "Test LED Strip",
      ipAddress: "192.168.1.200",
    });
    console.log("  ✅ Device created:", newDevice);

    // Get all devices
    console.log("  Fetching all devices...");
    const allDevices = await devicesApi.getAll();
    console.log(`  ✅ Found ${allDevices.length} device(s)`);

    // Get device by ID
    console.log("  Fetching device by ID...");
    const device = await devicesApi.getById(newDevice.id);
    console.log("  ✅ Device fetched:", device.name);

    // Update device
    console.log("  Updating device...");
    const updatedDevice = await devicesApi.update(newDevice.id, {
      name: "Updated Test LED Strip",
    });
    console.log("  ✅ Device updated:", updatedDevice.name);

    // Update last seen
    console.log("  Updating last seen...");
    const seenDevice = await devicesApi.updateLastSeen(newDevice.id);
    console.log("  ✅ Last seen updated:", seenDevice.lastSeen);

    // Delete device
    console.log("  Deleting test device...");
    await devicesApi.delete(newDevice.id);
    console.log("  ✅ Device deleted");

    return true;
  } catch (error) {
    console.error("  ❌ Devices API test failed:", error);
    return false;
  }
}

async function testPresets() {
  console.log("\n🎨 Testing Presets API...");

  try {
    // Create a test preset
    console.log("  Creating test preset...");
    const newPreset = await presetsApi.create({
      name: "Test Sunset",
      color: [255, 100, 50, 0],
      brightness: 200,
    });
    console.log("  ✅ Preset created:", newPreset.name);

    // Get all presets
    console.log("  Fetching all presets...");
    const allPresets = await presetsApi.getAll();
    console.log(`  ✅ Found ${allPresets.length} preset(s)`);

    // Get preset by ID
    console.log("  Fetching preset by ID...");
    const preset = await presetsApi.getById(newPreset.id);
    console.log("  ✅ Preset fetched:", preset.name);

    // Update preset
    console.log("  Updating preset...");
    const updatedPreset = await presetsApi.update(newPreset.id, {
      name: "Updated Test Sunset",
      brightness: 150,
    });
    console.log("  ✅ Preset updated:", updatedPreset.name, "brightness:", updatedPreset.brightness);

    // Get presets filtered by device
    console.log("  Fetching presets with filters...");
    const filteredPresets = await presetsApi.getAll({ deviceId: 1 });
    console.log(`  ✅ Found ${filteredPresets.length} preset(s) for device 1`);

    // Delete preset
    console.log("  Deleting test preset...");
    await presetsApi.delete(newPreset.id);
    console.log("  ✅ Preset deleted");

    return true;
  } catch (error) {
    console.error("  ❌ Presets API test failed:", error);
    return false;
  }
}

async function runTests() {
  console.log("🧪 Starting API Tests...\n");
  console.log("Make sure the backend server is running on http://localhost:3001\n");

  const results = {
    health: false,
    devices: false,
    presets: false,
  };

  results.health = await testHealth();
  results.devices = await testDevices();
  results.presets = await testPresets();

  console.log("\n" + "=".repeat(50));
  console.log("📊 Test Results Summary:");
  console.log("=".repeat(50));
  console.log(`  Health Check:  ${results.health ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`  Devices API:   ${results.devices ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`  Presets API:   ${results.presets ? "✅ PASS" : "❌ FAIL"}`);
  console.log("=".repeat(50));

  const allPassed = Object.values(results).every((r) => r);
  if (allPassed) {
    console.log("\n🎉 All tests passed!");
    process.exit(0);
  } else {
    console.log("\n⚠️  Some tests failed");
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

