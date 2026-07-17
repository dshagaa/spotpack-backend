// docs/index.ts — Scalar API Reference UI
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const spec = JSON.parse(
  Deno.readTextFileSync(new URL("./openapi.json", import.meta.url)),
);

const HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SpotPack API Reference</title>
  <style>body { margin: 0; }</style>
</head>
<body>
  <div id="app"></div>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  <script>
    Scalar.createApiReference('#app', {
      spec: { content: ${JSON.stringify(spec)} },
      theme: 'purple',
      darkMode: true,
    })
  </script>
</body>
</html>`;

serve((_req: Request) => {
  return new Response(HTML, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});
