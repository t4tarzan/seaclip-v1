import { Router } from "express";
import { z } from "zod";
import { requireAuth, validate } from "../middleware/index.js";
import * as edgeDevicesService from "../services/edge-devices.js";
import { publishLiveEvent } from "../services/live-events.js";

const router = Router({ mergeParams: true });

const RegisterDeviceSchema = z.object({
  name: z.string().min(1).max(255),
  deviceType: z.string().min(1).max(64),
  hardwareId: z.string().optional(),
  ipAddress: z.string().ip().optional(),
  endpoint: z.string().url().optional(),
  location: z.string().max(255).optional(),
  capabilities: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).optional(),
});

const UpdateDeviceSchema = RegisterDeviceSchema.partial();

const TelemetrySchema = z.object({
  cpuPercent: z.number().min(0).max(100).optional(),
  memoryPercent: z.number().min(0).max(100).optional(),
  diskPercent: z.number().min(0).max(100).optional(),
  gpuPercent: z.number().min(0).max(100).optional(),
  gpuMemoryPercent: z.number().min(0).max(100).optional(),
  temperatureCelsius: z.number().optional(),
  networkBytesIn: z.number().int().nonnegative().optional(),
  networkBytesOut: z.number().int().nonnegative().optional(),
  uptimeSeconds: z.number().int().nonnegative().optional(),
  customMetrics: z.record(z.number()).optional(),
  timestamp: z.string().datetime().optional(),
});

// GET /api/companies/:companyId/edge-devices
router.get("/:companyId/edge-devices", requireAuth, async (req, res, next) => {
  try {
    const devices = await edgeDevicesService.listEdgeDevices(String(req.params.companyId));
    res.json({ data: devices, count: devices.length });
  } catch (err) {
    next(err);
  }
});

// GET /api/companies/:companyId/edge-devices/mesh — topology (before :id to avoid conflict)
router.get("/:companyId/edge-devices/mesh", requireAuth, async (req, res, next) => {
  try {
    const topology = await edgeDevicesService.getMeshTopology(String(req.params.companyId));
    res.json(topology);
  } catch (err) {
    next(err);
  }
});

// POST /api/companies/:companyId/edge-devices
router.post(
  "/:companyId/edge-devices",
  requireAuth,
  validate(RegisterDeviceSchema),
  async (req, res, next) => {
    try {
      const device = await edgeDevicesService.registerEdgeDevice(String(req.params.companyId), req.body);
      await publishLiveEvent(String(req.params.companyId), {
        type: "edge_device.registered",
        device,
      });
      res.status(201).json(device);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/companies/:companyId/edge-devices/:id
router.get("/:companyId/edge-devices/:id", requireAuth, async (req, res, next) => {
  try {
    const device = await edgeDevicesService.getEdgeDevice(
      String(req.params.companyId),
      String(req.params.id),
    );
    res.json(device);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/companies/:companyId/edge-devices/:id
router.patch(
  "/:companyId/edge-devices/:id",
  requireAuth,
  validate(UpdateDeviceSchema),
  async (req, res, next) => {
    try {
      const device = await edgeDevicesService.updateEdgeDevice(
        String(req.params.companyId),
        String(req.params.id),
        req.body,
      );
      await publishLiveEvent(String(req.params.companyId), {
        type: "edge_device.updated",
        device,
      });
      res.json(device);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/companies/:companyId/edge-devices/:id
router.delete("/:companyId/edge-devices/:id", requireAuth, async (req, res, next) => {
  try {
    await edgeDevicesService.deregisterEdgeDevice(String(req.params.companyId), String(req.params.id));
    await publishLiveEvent(String(req.params.companyId), {
      type: "edge_device.deregistered",
      deviceId: String(req.params.id),
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// POST /api/companies/:companyId/edge-devices/:id/telemetry
router.post(
  "/:companyId/edge-devices/:id/telemetry",
  // Telemetry endpoint accepts device API key — no auth required here
  validate(TelemetrySchema),
  async (req, res, next) => {
    try {
      const telemetry = await edgeDevicesService.ingestTelemetry(
        String(req.params.companyId),
        String(req.params.id),
        req.body,
      );
      await publishLiveEvent(String(req.params.companyId), {
        type: "edge_device.telemetry",
        deviceId: String(req.params.id),
        telemetry,
      });
      res.status(202).json({ accepted: true, telemetry });
    } catch (err) {
      next(err);
    }
  },
);

export { router as edgeDevicesRouter };
