// docs/index.ts — Scalar API Reference UI
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SpotPack API Reference</title>
  <style>
    body { margin: 0; padding: 0; }
    #scalar { height: 100vh; }
  </style>
</head>
<body>
  <div id="scalar"></div>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@latest"></script>
  <script>
    Scalar.ApiReference(document.getElementById('scalar'), {
      spec: { url: './openapi.json' },
      theme: 'purple',
      darkMode: true,
      hideDownloadButton: false,
      showSidebar: true,
    })
  </script>
</body>
</html>`;

serve((req: Request) => {
  const url = new URL(req.url);

  // Serve OpenAPI spec
  if (url.pathname.endsWith("/openapi.json")) {
    const spec = Deno.readTextFileSync(
      new URL("./openapi.json", import.meta.url),
    );
    return new Response(spec, {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  // Serve Scalar UI
  return new Response(HTML, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});
