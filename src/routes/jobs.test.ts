import { describe, expect, test, mock, beforeAll, afterAll } from "bun:test";
import { scrapeQueue } from "../queues/scrapeQueue";
import { discoveryQueue } from "../queues/discoveryQueue";
import jobsRouter from "./jobs";

describe("Jobs Queue API Endpoints", () => {
  const originalGetJobsScrape = scrapeQueue.getJobs;
  const originalGetJobsDiscovery = discoveryQueue.getJobs;
  const originalGetJobScrape = scrapeQueue.getJob;
  const originalGetJobDiscovery = discoveryQueue.getJob;

  afterAll(() => {
    scrapeQueue.getJobs = originalGetJobsScrape;
    discoveryQueue.getJobs = originalGetJobsDiscovery;
    scrapeQueue.getJob = originalGetJobScrape;
    discoveryQueue.getJob = originalGetJobDiscovery;
  });

  const runRouteHandler = async (routeIndex: number, method: "GET", body: any = {}, reqQuery: any = {}, reqParams: any = {}) => {
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

    const routeHandler = jobsRouter.stack[routeIndex]!.route!.stack[0]!.handle;

    await routeHandler(mockReq, mockRes, (err: any) => {
      if (err) throw err;
    });

    return { status: resStatus, data: resData };
  };

  test("GET /jobs retrieves sorted merged list of discovery and scrape jobs", async () => {
    const mockDiscoveryJobs = [
      {
        id: "discover-france-123456",
        name: "discover-hashtag",
        progress: { percent: 100 },
        data: { hashtag: "france" },
        timestamp: 1600000000000,
        getState: async () => "completed",
        failedReason: undefined,
        finishedOn: 1600000001000,
        processedOn: 1600000000100
      }
    ];

    const mockScrapeJobs = [
      {
        id: "scrape-user-123457",
        name: "scrape-profile",
        progress: 50,
        data: { username: "user" },
        timestamp: 1700000000000,
        getState: async () => "active",
        failedReason: undefined,
        finishedOn: undefined,
        processedOn: 1700000000100
      }
    ];

    discoveryQueue.getJobs = async () => mockDiscoveryJobs as any;
    scrapeQueue.getJobs = async () => mockScrapeJobs as any;

    const { status, data } = await runRouteHandler(0, "GET");

    expect(status).toBe(200);
    expect(data.length).toBe(2);
    // Verified sorting (descending timestamp: 1700000000000 comes first)
    expect(data[0].id).toBe("scrape-user-123457");
    expect(data[0].queue).toBe("scrape");
    expect(data[0].state).toBe("active");
    expect(data[1].id).toBe("discover-france-123456");
    expect(data[1].queue).toBe("discovery");
    expect(data[1].state).toBe("completed");
  });

  test("GET /jobs/stats retrieves aggregate queue counts", async () => {
    discoveryQueue.getWaitingCount = async () => 2;
    discoveryQueue.getActiveCount = async () => 1;
    discoveryQueue.getCompletedCount = async () => 10;
    discoveryQueue.getFailedCount = async () => 1;

    scrapeQueue.getWaitingCount = async () => 3;
    scrapeQueue.getActiveCount = async () => 2;
    scrapeQueue.getCompletedCount = async () => 20;
    scrapeQueue.getFailedCount = async () => 2;

    const { status, data } = await runRouteHandler(1, "GET");

    expect(status).toBe(200);
    expect(data.waiting).toBe(5);
    expect(data.active).toBe(3);
    expect(data.completed).toBe(30);
    expect(data.failed).toBe(3);
  });

  test("GET /jobs/:id retrieves specific job deep-dive details", async () => {
    const mockJob = {
      id: "discover-france-123456",
      name: "discover-hashtag",
      progress: { percent: 100 },
      data: { hashtag: "france" },
      attemptsMade: 1,
      failedReason: undefined,
      returnvalue: { added: 5 },
      timestamp: 1600000000000,
      processedOn: 1600000000100,
      finishedOn: 1600000001000,
      getState: async () => "completed"
    };

    discoveryQueue.getJob = async (id) => {
      if (id === "discover-france-123456") return mockJob as any;
      return undefined;
    };

    const { status, data } = await runRouteHandler(2, "GET", {}, {}, { id: "discover-france-123456" });

    expect(status).toBe(200);
    expect(data.id).toBe("discover-france-123456");
    expect(data.state).toBe("completed");
    expect(data.attemptsMade).toBe(1);
    expect(data.returnvalue.added).toBe(5);
  });

  test("GET /jobs/:id returns 404 if job not found", async () => {
    discoveryQueue.getJob = async () => undefined;
    scrapeQueue.getJob = async () => undefined;

    const { status, data } = await runRouteHandler(2, "GET", {}, {}, { id: "nonexistent-job-id" });

    expect(status).toBe(404);
    expect(data.error).toBe("Job not found");
  });
});
