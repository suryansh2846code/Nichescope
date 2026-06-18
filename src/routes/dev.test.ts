import { describe, expect, test, mock, afterAll } from "bun:test";
import { scrapeQueue } from "../queues/scrapeQueue";
import { discoveryQueue } from "../queues/discoveryQueue";
import { analysisQueue } from "../queues/analysisQueue";
import { embeddingQueue } from "../queues/embeddingQueue";
import { leadQualificationQueue } from "../queues/leadQualificationQueue";
import { monitoringQueue } from "../queues/monitoringQueue";
import { userIntelligenceQueue } from "../queues/userIntelligenceQueue";
import devRouter from "./dev";

describe("Developer Mode API Endpoints", () => {
  const originalObliterateScrape = scrapeQueue.obliterate;
  const originalObliterateDiscovery = discoveryQueue.obliterate;
  const originalObliterateAnalysis = analysisQueue.obliterate;
  const originalObliterateEmbedding = embeddingQueue.obliterate;
  const originalObliterateLeadQual = leadQualificationQueue.obliterate;
  const originalObliterateMonitoring = monitoringQueue.obliterate;
  const originalObliterateUserIntel = userIntelligenceQueue.obliterate;
  const originalAddScrape = scrapeQueue.add;

  afterAll(() => {
    scrapeQueue.obliterate = originalObliterateScrape;
    discoveryQueue.obliterate = originalObliterateDiscovery;
    analysisQueue.obliterate = originalObliterateAnalysis;
    embeddingQueue.obliterate = originalObliterateEmbedding;
    leadQualificationQueue.obliterate = originalObliterateLeadQual;
    monitoringQueue.obliterate = originalObliterateMonitoring;
    userIntelligenceQueue.obliterate = originalObliterateUserIntel;
    scrapeQueue.add = originalAddScrape;
  });

  const runRouteHandler = async (routeIndex: number, method: "POST", body: any = {}) => {
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

    const routeHandler = devRouter.stack[routeIndex]!.route!.stack[0]!.handle;

    await routeHandler(mockReq, mockRes, (err: any) => {
      if (err) throw err;
    });

    return { status: resStatus, data: resData };
  };

  test("POST /dev/clear-queues drains both scrape and discovery queues", async () => {
    let scrapeObliterated = false;
    let discoveryObliterated = false;

    scrapeQueue.obliterate = async (opts) => {
      scrapeObliterated = true;
    };
    discoveryQueue.obliterate = async (opts) => {
      discoveryObliterated = true;
    };
    analysisQueue.obliterate = async () => {};
    embeddingQueue.obliterate = async () => {};
    leadQualificationQueue.obliterate = async () => {};
    monitoringQueue.obliterate = async () => {};
    userIntelligenceQueue.obliterate = async () => {};

    const { status, data } = await runRouteHandler(0, "POST");

    expect(status).toBe(200);
    expect(data.message).toBe("Queues cleared successfully");
    expect(scrapeObliterated).toBe(true);
    expect(discoveryObliterated).toBe(true);
  });

  test("POST /dev/trigger-scenario enqueues scenario successfully", async () => {
    let addedJob: any = null;

    scrapeQueue.add = async (name, data, opts) => {
      addedJob = { name, data, opts };
      return { id: opts?.jobId } as any;
    };

    const { status, data } = await runRouteHandler(1, "POST", {
      scenario: "private-account",
      username: "test_dev_user"
    });

    expect(status).toBe(200);
    expect(data.jobId).toBeDefined();
    expect(data.message).toContain("triggered for @test_dev_user");
    expect(addedJob).not.toBeNull();
    expect(addedJob.name).toBe("scrape-profile");
    expect(addedJob.data.username).toBe("test_dev_user");
    expect(addedJob.data.testScenario).toBe("private-account");
  });

  test("POST /dev/trigger-scenario returns 400 if validation fails", async () => {
    const { status, data } = await runRouteHandler(1, "POST", {
      scenario: "private-account"
    });

    expect(status).toBe(400);
    expect(data.error).toBe("scenario and username are required");
  });
});
