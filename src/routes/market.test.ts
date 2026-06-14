import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import mongoose from "mongoose";
import { connectToDatabase } from "../db";
import { MarketSnapshot } from "../models/MarketSnapshot";
import { TrendEvent } from "../models/TrendEvent";
import marketRouter from "./market";

describe("Market Router API Endpoints Unit Tests", () => {
  beforeAll(async () => {
    await connectToDatabase();
    await MarketSnapshot.deleteMany({});
    await TrendEvent.deleteMany({});

    // Seed a dummy snapshot and trend events
    await MarketSnapshot.create({
      snapshotDate: new Date(),
      categoryStats: [
        { category: "healthcare", count: 10, positiveSentiment: 2, neutralSentiment: 3, negativeSentiment: 5 },
      ],
      intentStats: [
        { intent: "seeking_help", count: 10 },
      ],
      keywordStats: [
        { keyword: "acne", count: 8 },
      ],
      topMentions: [
        { mention: "nike", count: 5 },
      ],
      totalUsers: 5,
      totalPosts: 12,
    });

    await TrendEvent.create([
      { type: "keyword_growth", entity: "acne", oldValue: 4, newValue: 8, growthRate: 100, detectedAt: new Date() },
      { type: "emerging_topic", entity: "acne", oldValue: 4, newValue: 8, growthRate: 100, detectedAt: new Date() },
    ]);
  });

  afterAll(async () => {
    await MarketSnapshot.deleteMany({});
    await TrendEvent.deleteMany({});
    await mongoose.connection.close();
  });

  const runRouteHandler = async (routeIndex: number, method: "GET" | "POST", reqQuery: any = {}, reqParams: any = {}) => {
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
    } as any;

    const routeHandler = marketRouter.stack[routeIndex]!.route!.stack[0]!.handle;

    await routeHandler(mockReq, mockRes, (err: any) => {
      if (err) throw err;
    });

    return { status: resStatus, data: resData };
  };

  test("GET /market/overview returns stats summary", async () => {
    // route index 0
    const { status, data } = await runRouteHandler(0, "GET");
    expect(status).toBe(200);
    expect(data.totalUsers).toBe(5);
    expect(data.totalPosts).toBe(12);
  });

  test("GET /market/categories returns category stats list", async () => {
    // route index 1
    const { status, data } = await runRouteHandler(1, "GET");
    expect(status).toBe(200);
    expect(data.length).toBe(1);
    expect(data[0].category).toBe("healthcare");
    expect(data[0].negativeSentiment).toBe(5);
  });

  test("GET /market/intents returns intent stats list", async () => {
    // route index 2
    const { status, data } = await runRouteHandler(2, "GET");
    expect(status).toBe(200);
    expect(data.length).toBe(1);
    expect(data[0].intent).toBe("seeking_help");
  });

  test("GET /market/keywords returns keyword list", async () => {
    // route index 3
    const { status, data } = await runRouteHandler(3, "GET", { limit: "1" });
    expect(status).toBe(200);
    expect(data.length).toBe(1);
    expect(data[0].keyword).toBe("acne");
  });

  test("GET /market/trends returns trend events", async () => {
    // route index 4
    const { status, data } = await runRouteHandler(4, "GET", { type: "keyword_growth" });
    expect(status).toBe(200);
    expect(data.length).toBe(1);
    expect(data[0].entity).toBe("acne");
    expect(data[0].type).toBe("keyword_growth");
  });

  test("GET /market/emerging-topics returns topics list", async () => {
    // route index 5
    const { status, data } = await runRouteHandler(5, "GET");
    expect(status).toBe(200);
    expect(data.length).toBe(1);
    expect(data[0].topic).toBe("acne");
    expect(data[0].growthRate).toBe(100);
  });

  test("GET /market/mentions returns mentions stats list", async () => {
    // route index 6
    const { status, data } = await runRouteHandler(6, "GET");
    expect(status).toBe(200);
    expect(data.length).toBe(1);
    expect(data[0].mention).toBe("nike");
  });

  test("POST /market/trigger enqueues job successfully", async () => {
    // route index 7
    const { status, data } = await runRouteHandler(7, "POST");
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.jobId).toBeDefined();
  });
});
