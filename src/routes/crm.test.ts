import { describe, expect, test, beforeAll, afterAll, beforeEach } from "bun:test";
import mongoose from "mongoose";
import { connectToDatabase } from "../db";
import { LeadPipeline } from "../models/LeadPipeline";
import { LeadActivity } from "../models/LeadActivity";
import { LeadQualification } from "../models/LeadQualification";
import { UserIntelligence } from "../models/UserIntelligence";
import crmRouter from "./crm";

describe("CRM Pipeline API Endpoints", () => {
  const testUser = "test_crm_user";

  beforeAll(async () => {
    await connectToDatabase();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clean collections before each test
    await LeadPipeline.deleteMany({});
    await LeadActivity.deleteMany({});
    await LeadQualification.deleteMany({});
    await UserIntelligence.deleteMany({});

    // Seed test data
    await LeadQualification.create({
      username: testUser,
      leadScore: 92,
      problem: "Acne skin breakouts",
      serviceNeeded: "Dermatologist",
      urgency: "high",
      buyingIntent: 90,
      confidence: 85,
      qualificationReason: "Skincare recommendation",
      recommendedAction: "Reach out",
      category: "healthcare",
      intent: "seeking_recommendation",
      qualifiedAt: new Date()
    });

    await LeadPipeline.create({
      username: testUser,
      status: "new",
      priority: "high",
      assignedTo: "",
      notes: [],
      tags: [],
      lastActivityAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await UserIntelligence.create({
      username: testUser,
      overallCategory: "healthcare",
      overallIntent: "seeking_recommendation",
      confidence: 85,
      leadScore: 92,
      summary: "Acne breakouts",
      postCountAnalyzed: 1,
      leadPostCount: 1,
      categories: [{ category: "healthcare", count: 1 }],
      intents: [{ intent: "seeking_recommendation", count: 1 }],
      analyzedAt: new Date()
    });

    await LeadActivity.create({
      username: testUser,
      type: "created",
      newValue: "new",
      createdAt: new Date()
    });
  });

  const runRouteHandler = async (routeIndex: number, method: "GET" | "POST" | "PATCH", body: any = {}, reqQuery: any = {}, reqParams: any = {}) => {
    let resData: any = null;
    let resStatus = 200;

    const mockReq = {
      body,
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

    const routeHandler = crmRouter.stack[routeIndex]!.route!.stack[0]!.handle;

    await routeHandler(mockReq, mockRes, (err: any) => {
      if (err) throw err;
    });

    return { status: resStatus, data: resData };
  };

  test("GET /crm/leads retrieves all leads in pipeline with filters and qualification join", async () => {
    const { status, data } = await runRouteHandler(0, "GET", {}, { status: "new", priority: "high" });

    expect(status).toBe(200);
    expect(data.length).toBe(1);
    expect(data[0].username).toBe(testUser);
    expect(data[0].problem).toBe("Acne skin breakouts");
    expect(data[0].serviceNeeded).toBe("Dermatologist");
    expect(data[0].buyingIntent).toBe(90);
    expect(data[0].leadScore).toBe(92);
  });

  test("GET /crm/stats retrieves stats counts and conversion metrics", async () => {
    const { status, data } = await runRouteHandler(1, "GET");

    expect(status).toBe(200);
    expect(data.new).toBe(1);
    expect(data.conversionRate).toBe(0.0);
  });

  test("GET /crm/activity retrieves global activity feed logs", async () => {
    const { status, data } = await runRouteHandler(2, "GET");

    expect(status).toBe(200);
    expect(data.length).toBe(1);
    expect(data[0].username).toBe(testUser);
    expect(data[0].type).toBe("created");
  });

  test("GET /crm/leads/:username retrieves lead deep-dive", async () => {
    const { status, data } = await runRouteHandler(3, "GET", {}, {}, { username: testUser });

    expect(status).toBe(200);
    expect(data.pipeline.username).toBe(testUser);
    expect(data.qualification.problem).toBe("Acne skin breakouts");
    expect(data.userIntelligence.summary).toBe("Acne breakouts");
    expect(data.activity.length).toBe(1);
  });

  test("PATCH /crm/leads/:username/status updates lead status and logs activity", async () => {
    const { status, data } = await runRouteHandler(4, "PATCH", { status: "converted" }, {}, { username: testUser });

    expect(status).toBe(200);
    expect(data.status).toBe("converted");

    const activity = await LeadActivity.find({ username: testUser }).sort({ createdAt: -1 });
    expect(activity.length).toBe(2);
    expect(activity[0].type).toBe("converted");
    expect(activity[0].oldValue).toBe("new");
    expect(activity[0].newValue).toBe("converted");
  });

  test("PATCH /crm/leads/:username/assign updates assignee and logs activity", async () => {
    const { status, data } = await runRouteHandler(5, "PATCH", { assignedTo: "Alice" }, {}, { username: testUser });

    expect(status).toBe(200);
    expect(data.assignedTo).toBe("Alice");

    const activity = await LeadActivity.find({ username: testUser }).sort({ createdAt: -1 });
    expect(activity.length).toBe(2);
    expect(activity[0].type).toBe("assigned");
    expect(activity[0].oldValue).toBe("");
    expect(activity[0].newValue).toBe("Alice");
  });

  test("POST /crm/leads/:username/notes appends note and logs activity", async () => {
    const { status, data } = await runRouteHandler(6, "POST", { content: "Needs urgent follow-up" }, {}, { username: testUser });

    expect(status).toBe(200);
    expect(data.notes.length).toBe(1);
    expect(data.notes[0].content).toBe("Needs urgent follow-up");

    const activity = await LeadActivity.find({ username: testUser }).sort({ createdAt: -1 });
    expect(activity.length).toBe(2);
    expect(activity[0].type).toBe("note_added");
    expect(activity[0].newValue).toBe("Needs urgent follow-up");
  });

  test("POST /crm/leads/:username/tags appends tag", async () => {
    const { status, data } = await runRouteHandler(7, "POST", { tag: "skincare" }, {}, { username: testUser });

    expect(status).toBe(200);
    expect(data.tags.includes("skincare")).toBe(true);

    const updated = await LeadPipeline.findOne({ username: testUser });
    expect(updated?.tags.includes("skincare")).toBe(true);
  });
});
