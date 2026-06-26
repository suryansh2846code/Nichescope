import Redis from "ioredis";
import { createRedisConnectionOptions } from "../../queues/redis";
import { DiscoverySession } from "../../models/DiscoverySession";

export function startWebSocketServer(port: number) {
  console.log(`[WebSocket] Starting native WebSocket server on ws://localhost:${port}`);

  const server = Bun.serve<{ sessionId: string }>({
    port,
    fetch(req, server) {
      const url = new URL(req.url);
      const pathname = url.pathname;

      if (pathname.startsWith("/ws/discovery/")) {
        const sessionId = pathname.split("/").pop();
        if (!sessionId) {
          return new Response("Missing session ID", { status: 400 });
        }

        const upgraded = server.upgrade(req, {
          data: { sessionId },
        });

        if (upgraded) {
          return undefined; // Bun handles connection
        }
      }

      return new Response("Not a WebSocket upgrade request", { status: 400 });
    },
    websocket: {
      async open(ws) {
        const { sessionId } = ws.data;
        console.log(`[WebSocket] Client connected: session=${sessionId}`);

        try {
          // 1. Fetch historical events from MongoDB and stream them immediately
          const session = await DiscoverySession.findOne({ sessionId });
          if (session) {
            ws.send(
              JSON.stringify({
                type: "history",
                events: session.events || [],
                stats: session.stats || {
                  postsFound: 0,
                  commentsExtracted: 0,
                  commentsQualified: 0,
                  leadsCreated: 0,
                },
                status: session.status || "running",
              })
            );
          } else {
            // Send empty history if session not created in DB yet
            ws.send(
              JSON.stringify({
                type: "history",
                events: [],
                stats: {
                  postsFound: 0,
                  commentsExtracted: 0,
                  commentsQualified: 0,
                  leadsCreated: 0,
                },
                status: "running",
              })
            );
          }

          // 2. Create a dedicated Redis subscriber for this client connection
          const redisOptions = createRedisConnectionOptions();
          const subscriber = new Redis(redisOptions);

          // Attach to WebSocket context for cleanup on close
          (ws as any).redisSubscriber = subscriber;

          const channel = `discovery:${sessionId}`;
          await subscriber.subscribe(channel);

          subscriber.on("message", (chan, message) => {
            // Forward real-time event directly to client
            ws.send(message);
          });

          subscriber.on("error", (err) => {
            console.error(`[WebSocket] Redis Subscriber Error for session ${sessionId}:`, err);
          });
        } catch (err) {
          console.error(`[WebSocket] Error setting up client connection for session ${sessionId}:`, err);
          ws.close(1011, "Internal server error");
        }
      },
      async message(ws, message) {
        // Handle incoming WebSocket messages if needed (e.g. ping/pong, pause, cancel)
        console.log(`[WebSocket] Message from client: ${message}`);
      },
      async close(ws, code, message) {
        const { sessionId } = ws.data;
        console.log(`[WebSocket] Client disconnected: session=${sessionId}, code=${code}`);

        // Cleanup Redis subscription to prevent memory leaks
        const subscriber = (ws as any).redisSubscriber as Redis | undefined;
        if (subscriber) {
          try {
            const channel = `discovery:${sessionId}`;
            await subscriber.unsubscribe(channel);
            await subscriber.quit();
            console.log(`[WebSocket] Redis Subscriber cleaned up for session=${sessionId}`);
          } catch (err) {
            console.error(`[WebSocket] Error closing Redis subscriber for session ${sessionId}:`, err);
          }
        }
      },
    },
  });

  return server;
}
