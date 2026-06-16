import { describe, expect, test, beforeAll, afterAll, beforeEach } from "bun:test";
import mongoose from "mongoose";
import { connectToDatabase } from "../db";
import { LeadQualification } from "../models/LeadQualification";
import { UserIntelligence } from "../models/UserIntelligence";
import { Post } from "../models/Post";
import { PostAnalysis } from "../models/PostAnalysis";
import { LeadScoreHistory } from "../models/LeadScoreHistory";
import leadsRouter from "./leads";

describe("Leads Inbox API Endpoints", () => {
  const testUser = "test_inbox_user";

  beforeAll(async () => {
    await connectToDatabase();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clean database before each test
    await LeadQualification.deleteMany({});
    await UserIntelligence.deleteMany({});
    await Post.deleteMany({});
    await PostAnalysis.deleteMany({});
    await LeadScoreHistory.deleteMany({});

    // Seed test qualified lead
    await LeadQualification.create({
      username: testUser,
      leadScore: 95,
      problem: "Acne issues",
      serviceNeeded: "Dermatologist",
      urgency: "high",
      buyingIntent: 92,
      confidence: 90,
      qualificationReason: "Highly urgent skincare query",
      recommendedAction: "Contact immediately",
      supportingPosts: ["https://instagram.com/p/test_inbox_post_1"],
      category: "healthcare",
      intent: "seeking_recommendation",
      qualifiedAt: new Date()
    });

    await UserIntelligence.create({
      username: testUser,
      overallCategory: "healthcare",
      overallIntent: "seeking_recommendation",
      confidence: 90,
      leadScore: 95,
      summary: "Acne issues",
      postCountAnalyzed: 1,
      leadPostCount: 1,
      categories: [{ category: "healthcare", count: 1 }],
      intents: [{ intent: "seeking_recommendation", count: 1 }],
      analyzedAt: new Date()
    });

    await Post.create({
      postId: "test_inbox_post_1",
      username: testUser,
      caption: "skincare recommendation needed for acne breakouts",
      postUrl: "https://instagram.com/p/test_inbox_post_1",
      postedAt: new Date(),
      scrapedAt: new Date()
    });

    await PostAnalysis.create({
      postId: "test_inbox_post_1",
      username: testUser,
      isLead: true,
      category: "healthcare",
      intent: "seeking_recommendation",
      confidence: 90,
      leadScore: 95,
      summary: "Wants dermatologist recommendations.",
      analyzedAt: new Date()
    });

    await LeadScoreHistory.create({
      username: testUser,
      leadScore: 95,
      category: "healthcare",
      intent: "seeking_recommendation",
      recordedAt: new Date()
    });
  });

  const runRouteHandler = async (routeIndex: number, method: "GET" | "POST", reqQuery: any = {}, reqParams: any = {}) => {
    let resData: any = null;
    let resStatus = 200;
    let writtenData = "";
    let headers: Record<string, string> = {};

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
      setHeader: (name: string, value: string) => {
        headers[name] = value;
      },
      write: (data: string) => {
        writtenData += data;
      },
      end: () => {}
    } as any;

    const routeHandler = leadsRouter.stack[routeIndex]!.route!.stack[0]!.handle;

    await routeHandler(mockReq, mockRes, (err: any) => {
      if (err) throw err;
    });

    return { status: resStatus, data: resData, writtenData, headers };
  };

  test("GET /leads/inbox supports filtering by urgency, service, buyingIntent, category", async () => {
    // Route index 3: GET /inbox
    const { status, data } = await runRouteHandler(3, "GET", {
      urgency: "high",
      category: "healthcare",
      buyingIntent: "90",
      service: "Dermatologist"
    });

    expect(status).toBe(200);
    expect(data.length).toBe(1);
    expect(data[0].username).toBe(testUser);
    expect(data[0].urgency).toBe("high");
    expect(data[0].serviceNeeded).toBe("Dermatologist");
    expect(data[0].buyingIntent).toBe(92);
  });

  test("GET /leads/inbox filters out non-matching records", async () => {
    // Route index 3: GET /inbox
    const { status, data } = await runRouteHandler(3, "GET", {
      urgency: "low"
    });

    expect(status).toBe(200);
    expect(data.length).toBe(0);
  });

  test("GET /leads/inbox/:username retrieves full detail profile", async () => {
    // Route index 4: GET /inbox/:username
    const { status, data } = await runRouteHandler(4, "GET", {}, { username: testUser });

    expect(status).toBe(200);
    expect(data.qualification).toBeDefined();
    expect(data.qualification.username).toBe(testUser);
    expect(data.supportingPosts.length).toBe(1);
    expect(data.supportingPosts[0].postId).toBe("test_inbox_post_1");
    expect(data.userIntelligence.summary).toBe("Acne issues");
    expect(data.leadHistory.length).toBe(1);
    expect(data.leadHistory[0].leadScore).toBe(95);
  });

  test("GET /leads/export supports JSON format", async () => {
    // Route index 2: GET /export
    const { status, data } = await runRouteHandler(2, "GET", { format: "json" });

    expect(status).toBe(200);
    expect(data.length).toBe(1);
    expect(data[0].username).toBe(testUser);
    expect(data[0].serviceNeeded).toBe("Dermatologist");
  });

  test("GET /leads/export supports CSV format", async () => {
    // Route index 2: GET /export
    const { status, writtenData, headers } = await runRouteHandler(2, "GET", { format: "csv" });

    expect(headers["Content-Type"]).toBe("text/csv");
    expect(writtenData).toContain("username,serviceNeeded,urgency,buyingIntent,leadScore,qualificationReason");
    expect(writtenData).toContain(`${testUser},Dermatologist,high,92,95,Highly urgent skincare query`);
  });
});
