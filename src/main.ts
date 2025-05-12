import express from 'express';
import server from './server';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const app = express();

app.use(express.json());

app.post('/mcp', async (req, res) => {
  console.log('Received MCP request:', JSON.stringify(req.headers), JSON.stringify(req.body).slice(0, 200) + '...');
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    req.on('close', () => {
      transport.close();
      server.close();
    });
  } catch (error) {
    console.error('Error processing MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Internal server error',
          data: (error as Error).message,
        },
        id: req.body?.id || null,
      });
    }
  }
});
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});
app.options('/mcp', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(204);
});

app.get('/mcp', (req, res) => res.status(405).json({ error: 'Method not allowed' }));

app.delete('/mcp', (req, res) => res.status(405).json({ error: 'Method not allowed' }));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`MCP server listening on port ${PORT}`));
