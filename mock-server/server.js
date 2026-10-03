const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 4010;
const specPath = path.resolve(__dirname, '../api/openapi.yaml');

function send(res, status, body, contentType='text/plain'){
  res.writeHead(status, {'Content-Type': contentType});
  res.end(body);
}

const docsHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>FTree API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist/swagger-ui.css" />
  <style>html,body{height:100%;margin:0;}#swagger-ui{height:100vh}</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      fetch('/openapi.yaml').then(r => r.text()).then(yamlText => {
        const ui = SwaggerUIBundle({
          spec: jsyaml ? jsyaml.load(yamlText) : undefined,
          url: '/openapi.yaml',
          dom_id: '#swagger-ui',
          deepLinking: true,
          presets: [SwaggerUIBundle.presets.apis],
        });
      }).catch(err => {
        document.getElementById('swagger-ui').innerText = 'Failed to load OpenAPI spec: ' + err;
      });
    };
  </script>
  <script src="https://unpkg.com/js-yaml@4.1.0/dist/js-yaml.min.js"></script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/docs')) {
    return send(res, 200, docsHtml, 'text/html');
  }
  if (req.method === 'GET' && req.url === '/openapi.yaml') {
    fs.readFile(specPath, 'utf8', (err, data) => {
      if (err) return send(res, 404, 'openapi.yaml not found');
      send(res, 200, data, 'text/yaml');
    });
    return;
  }
  // serve any static files under repo for debugging if needed
  if (req.method === 'GET' && req.url.startsWith('/')) {
    send(res, 404, 'Not found');
    return;
  }
  send(res, 405, 'Method not allowed');
});

server.listen(port, () => console.log(`Mock Swagger server running at http://localhost:${port} (docs: /docs)`));
