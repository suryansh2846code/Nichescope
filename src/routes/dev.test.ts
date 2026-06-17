import { describe, expect, test, mock, afterAll } from "bun:test";
import { scrapeQueue } from "../queues/scrapeQueue";
import { discoveryQueue } from "../queues/discoveryQueue";
import devRouter from "./dev";

describe("Developer Mode API Endpoints", () => {
  const originalDrainScrape = scrapeQueue.drain;
  const originalDrainDiscovery = discoveryQueue.drain;
  const originalAddScrape = scrapeQueue.add;

  afterAll(() => {
    scrapeQueue.drain = originalDrainScrape;
    discoveryQueue.drain = originalDrainDiscovery;
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
    let scrapeDrained = false;
    let discoveryDrained = false;

    scrapeQueue.drain = async (clean) => {
      scrapeDrained = true;
    };
    discoveryQueue.drain = async (clean) => {
      discoveryDrained = true;
    };

    const { status, data } = await runRouteHandler(0, "POST");

    expect(status).toBe(200);
    expect(data.message).toBe("Queues cleared successfully");
    expect(scrapeDrained).toBe(true);
    expect(discoveryDrained).toBe(true);
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
