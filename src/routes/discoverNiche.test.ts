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

  const runRouteHandler = async (routePath: string, method: "POST", reqQuery: any = {}, reqParams: any = {}) => {
    let resData: any = null;
    let resStatus = 200;

    const mockReq = {
      query: reqQuery,
      params: reqParams,
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

  test("POST /discover/niche/:niche/run returns 400 if niche has 0 active influencers", async () => {
    const { status, data } = await runRouteHandler("/niche/:niche/run", "POST", {}, { niche: "saas" });

    expect(status).toBe(400);
    expect(data.error).toContain('No active influencers found in niche "saas"');
  });

  test("POST /discover/niche/:niche/run returns 400 if niche has > 5 active influencers", async () => {
    // Seed 6 active influencers under "fitness" niche
    const influencers = Array.from({ length: 6 }).map((_, i) => ({
      username: `fit_influencer_${i}`,
      niche: "fitness",
      isActive: true,
      isProcessed: false
    }));
    await SeedInfluencer.create(influencers);

    const { status, data } = await runRouteHandler("/niche/:niche/run", "POST", {}, { niche: "fitness" });

    expect(status).toBe(400);
    expect(data.error).toContain("A niche process can run a maximum of 5 influencers");
  });

  test("POST /discover/niche/:niche/run runs successfully for 1 to 5 active influencers", async () => {
    // Seed 3 active influencers in "beauty" niche, and 1 inactive
    await SeedInfluencer.create([
      { username: "beauty_inf_1", niche: "beauty", isActive: true },
      { username: "beauty_inf_2", niche: "beauty", isActive: true },
      { username: "beauty_inf_3", niche: "beauty", isActive: true },
      { username: "beauty_inf_4", niche: "beauty", isActive: false },
    ]);

    const addedJobs: any[] = [];
    influencerDiscoveryQueue.add = async (name, data, opts) => {
      addedJobs.push({ name, data, opts });
      return { id: opts?.jobId } as any;
    };

    const { status, data } = await runRouteHandler("/niche/:niche/run", "POST", {}, { niche: "beauty" });

    expect(status).toBe(202);
    expect(data.message).toContain('Niche group process started for "beauty" with 3 active influencers');
    expect(data.runs.length).toBe(3);
    expect(addedJobs.length).toBe(3);

    // Verify DiscoverySessions are created in database
    const sessions = await DiscoverySession.find({ niche: "beauty" });
    expect(sessions.length).toBe(3);
    expect(sessions.map(s => s.username).sort()).toEqual(["beauty_inf_1", "beauty_inf_2", "beauty_inf_3"]);
  });
});
