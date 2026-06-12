import index from "./index.html";

const port = process.env.FRONTEND_PORT || 5173;

Bun.serve({
  port,
  routes: {
    "/": index,
  },
  development: {
    hmr: true,
  },
});

console.log(`Frontend dashboard server running at http://localhost:${port}`);
