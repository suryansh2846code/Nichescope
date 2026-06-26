import { describe, expect, test, beforeAll, afterAll, beforeEach } from "bun:test";
import mongoose from "mongoose";
import { connectToDatabase } from "../db";
import { SeedInfluencer } from "../models/SeedInfluencer";
import { DiscoverySession } from "../models/DiscoverySession";
import { influencerDiscoveryQueue } from "../queues/commentQueues";
import discoverRouter from "./discover";

describe("Niche Group Scan API Endpoint", () => {
  const originalAdd = influencerDiscoveryQueue.add;

  beforeAll(async () => {
    await connectToDatabase();
  });

  afterAll(async () => {
    influencerDiscoveryQueue.add = originalAdd;
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await SeedInfluencer.deleteMany({});
    await DiscoverySession.deleteMany({});
  });

  const runRouteHandler = async (routePath: string, method: "POST", body: any = {}) => {
    let resData: any = null;
    let resStatus = 200;

    const mockReq = {
      body,
      query: {},
      params: {},
      method,
    } as any;

    const mockRes = {
      json: (data: any) => {
        resData = data;
        return mockRes;
      },
      status: (code: number) => {
        resStatus = code;
        return mockRes;
      },
      setHeader: () => {},
      end: () => {}
    } as any;

    const methodLower = method.toLowerCase();
    const routeLayer = discoverRouter.stack.find(
      (layer: any) =>
        layer.route &&
        layer.route.path === routePath &&
        layer.route.methods[methodLower]
    );

    if (!routeLayer) {
      throw new Error(`Route handler not found for path: ${routePath}, method: ${method}`);
    }

    const routeHandler = routeLayer.route!.stack[0]!.handle;

    await routeHandler(mockReq, mockRes, (err: any) => {
      if (err) throw err;
    });

    return { status: resStatus, data: resData };
  };

  test("POST /discover/run-niche-scan returns 400 if usernames array is empty", async () => {
    const { status, data } = await runRouteHandler("/run-niche-scan", "POST", {
      niche: "saas",
      usernames: []
    });

    expect(status).toBe(400);
    expect(data.error).toContain("At least 1 seed influencer is required");
  });

  test("POST /discover/run-niche-scan returns 400 if usernames count is > 5", async () => {
    const { status, data } = await runRouteHandler("/run-niche-scan", "POST", {
      niche: "fitness",
      usernames: ["u1", "u2", "u3", "u4", "u5", "u6"]
    });

    expect(status).toBe(400);
    expect(data.error).toContain("maximum of 5 influencers");
  });

  test("POST /discover/run-niche-scan runs successfully for 1 to 5 influencers", async () => {
    const addedJobs: any[] = [];
    influencerDiscoveryQueue.add = async (name, data, opts) => {
      addedJobs.push({ name, data, opts });
      return { id: opts?.jobId } as any;
    };

    const { status, data } = await runRouteHandler("/run-niche-scan", "POST", {
      niche: "beauty",
      usernames: ["beauty_inf_1", "beauty_inf_2", "beauty_inf_3"]
    });

    expect(status).toBe(202);
    expect(data.message).toContain('Niche scan process started for "beauty" with 3 influencers');
    expect(data.runs.length).toBe(3);
    expect(addedJobs.length).toBe(3);

    // Verify DiscoverySessions are created in database
    const sessions = await DiscoverySession.find({ niche: "beauty" });
    expect(sessions.length).toBe(3);
    expect(sessions.map(s => s.username).sort()).toEqual(["beauty_inf_1", "beauty_inf_2", "beauty_inf_3"]);
  });
});
