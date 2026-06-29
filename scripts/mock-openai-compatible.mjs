import http from "node:http";

const port = Number(process.env.MOCK_AI_PORT ?? process.argv[2] ?? 4010);
const host = process.env.MOCK_AI_HOST ?? "127.0.0.1";

const server = http.createServer((request, response) => {
  request.resume();
  request.on("end", () => {
    if (request.url?.includes("/chat/completions")) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          model: "mock-chat",
          choices: [
            {
              message: {
                content: "Mock provider answer with citation [S1]",
              },
            },
          ],
          usage: {
            prompt_tokens: 11,
            completion_tokens: 7,
            total_tokens: 18,
          },
        }),
      );
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not found" }));
  });
});

server.listen(port, host, () => {
  console.log(`Mock OpenAI-compatible API listening on http://${host}:${port}/v1`);
});
