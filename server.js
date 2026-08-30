import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'dist')));

async function queryMondayAPI(token, query, variables = {}) {
  const response = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token,
      'API-Version': '2023-10'
    },
    body: JSON.stringify({ query, variables })
  });

  const json = await response.json();
  if (json.errors) {
    throw new Error(json.errors.map(e => e.message).join(', '));
  }
  return json.data;
}

async function fetchBoardData(token, boardId) {
  const query = `
    query GetBoardData($boardId: [ID!]) {
      boards(ids: $boardId) {
        id
        name
        columns { id title type }
        items_page(limit: 500) {
          cursor
          items {
            id
            name
            column_values { id text value }
          }
        }
      }
    }
  `;

  const data = await queryMondayAPI(token, query, { boardId });
  const board = data.boards?.[0];
  if (!board) throw new Error(`Board ID ${boardId} not found or inaccessible.`);

  let items = board.items_page?.items || [];
  let cursor = board.items_page?.cursor;

  while (cursor) {
    const next = await queryMondayAPI(token, `
      query NextItems($cursor: String!) {
        next_items_page(cursor: $cursor) {
          cursor
          items { id name column_values { id text value } }
        }
      }
    `, { cursor });
    items = items.concat(next.next_items_page?.items || []);
    cursor = next.next_items_page?.cursor;
  }

  const columns = board.columns || [];
  const rows = items.map(item => {
    const row = { 'Item ID': item.id, 'Item Name': item.name };
    for (const val of item.column_values || []) {
      const colDef = columns.find(c => c.id === val.id);
      if (colDef) row[colDef.title] = val.text;
    }
    return row;
  });

  return {
    boardName: board.name,
    columns: columns.map(c => ({ id: c.id, title: c.title, type: c.type })),
    rows
  };
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'skylark-drones-bi-agent',
    configured: Boolean(process.env.MONDAY_API_TOKEN && process.env.GEMINI_API_KEY)
  });
});

app.post('/api/sync', async (req, res) => {
  const { mondayToken, dealsBoardId, workOrdersBoardId } = req.body;
  if (!mondayToken || !dealsBoardId || !workOrdersBoardId) {
    return res.status(400).json({ error: 'Missing credentials or Board IDs.' });
  }

  try {
    const [dealsMeta, workOrdersMeta] = await Promise.all([
      fetchBoardData(mondayToken, dealsBoardId),
      fetchBoardData(mondayToken, workOrdersBoardId)
    ]);

    res.json({
      success: true,
      deals: { boardName: dealsMeta.boardName, rowCount: dealsMeta.rows.length, columns: dealsMeta.columns },
      workOrders: { boardName: workOrdersMeta.boardName, rowCount: workOrdersMeta.rows.length, columns: workOrdersMeta.columns }
    });
  } catch (error) {
    console.error('Sync Error:', error.message);
    res.status(502).json({ error: 'Unable to read monday.com boards. Verify the token, board IDs, and permissions.' });
  }
});

app.post('/api/chat', async (req, res) => {
  const { mondayToken, dealsBoardId, workOrdersBoardId, geminiApiKey, messages } = req.body;
  if (!mondayToken || !dealsBoardId || !workOrdersBoardId || !geminiApiKey) {
    return res.status(400).json({ error: 'Missing required credentials, Board IDs, or API Key.' });
  }

  try {
    const [dealsData, workOrdersData] = await Promise.all([
      fetchBoardData(mondayToken, dealsBoardId),
      fetchBoardData(mondayToken, workOrdersBoardId)
    ]);

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      tools: [{ codeExecution: {} }]
    });

    const systemInstruction = `
You are a founder-level Business Intelligence Agent for Skylark Drones.
You have two live monday.com datasets: Sales Deals and Work Orders.
Use the actual records supplied below. Never invent numbers. Treat missing values as unknown, not zero.
Normalize date, numeric, casing, spacing, and status inconsistencies before analysis.
Use Python code execution for arithmetic and aggregation.
Answer at executive level: state the conclusion, key metrics, notable trends, risks/caveats, and recommended next actions.

DEALS DATA:
${JSON.stringify(dealsData.rows)}

WORK ORDERS DATA:
${JSON.stringify(workOrdersData.rows)}
`;

    const chat = model.startChat({
      systemInstruction,
      history: Array.isArray(messages)
        ? messages.slice(-12).map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
        : []
    });

    const lastUserMessage = Array.isArray(messages) && messages.length
      ? messages[messages.length - 1]?.content
      : '';

    const result = await chat.sendMessage(lastUserMessage || 'Provide an executive summary of the current business data.');
    const response = result.response;

    res.json({
      answer: response.text(),
      executionLogs: [],
      sources: {
        deals: { boardName: dealsData.boardName, rows: dealsData.rows.length },
        workOrders: { boardName: workOrdersData.boardName, rows: workOrdersData.rows.length }
      }
    });
  } catch (error) {
    console.error('Chat Error:', error);
    res.status(502).json({ error: 'The BI analysis failed. Check the monday.com connection and Gemini API key, then retry.' });
  }
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API route not found.' });
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Skylark BI Agent running on port ${PORT}`));
