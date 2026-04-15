const express = require('express');
const cors    = require('cors');
const fetch   = require('node-fetch');

const app  = express();
const PORT = process.env.PORT || 3001;

// Config
const BILLIT_BASE  = process.env.BILLIT_BASE_URL || 'https://app.billit.be/api';
const BILLIT_TOKEN = process.env.BILLIT_API_TOKEN || '';

// CORS : autorise GitHub Pages + localhost
app.use(cors({
  origin: [
    'https://erikerpivar-max.github.io',
    'http://localhost',
    'http://127.0.0.1',
    /^http:\/\/localhost:\d+$/,
  ]
}));

// Helper : appel API Billit
async function billitFetch(path) {
  if (!BILLIT_TOKEN) throw new Error('BILLIT_API_TOKEN non configure');
  const url = BILLIT_BASE + path;
  const res  = await fetch(url, {
    headers: {
      'Authorization': 'Bearer ' + BILLIT_TOKEN,
      'Accept':        'application/json',
      'Content-Type':  'application/json',
    }
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error('Billit API ' + res.status + ': ' + txt);
  }
  return res.json();
}

// Calcul du trimestre courant
function getQuarterRange() {
  const now = new Date();
  const m   = now.getMonth();
  const y   = now.getFullYear();
  let from, to;
  if      (m <= 2)  { from = y + '-01-01'; to = y + '-03-31'; }
  else if (m <= 5)  { from = y + '-04-01'; to = y + '-06-30'; }
  else if (m <= 8)  { from = y + '-07-01'; to = y + '-09-30'; }
  else              { from = y + '-10-01'; to = y + '-12-31'; }
  return { from, to };
}

// Normalise les champs des factures
function normalizeInvoice(inv) {
  return Object.assign({}, inv, {
    TotalExcl: inv.TotalExcl != null ? inv.TotalExcl : (inv.totalExcl != null ? inv.totalExcl : (inv.amountExcl != null ? inv.amountExcl : 0)),
    TotalVAT:  inv.TotalVAT  != null ? inv.TotalVAT  : (inv.totalVat  != null ? inv.totalVat  : (inv.vatAmount  != null ? inv.vatAmount  : 0)),
  });
}

// GET /billit/sales
app.get('/billit/sales', async (req, res) => {
  try {
    const { from, to } = getQuarterRange();
    const data = await billitFetch('/invoices?type=sales&dateFrom=' + from + '&dateTo=' + to + '&limit=500');
    const list = Array.isArray(data) ? data : (data.value || data.data || data.items || []);
    res.json(list.map(normalizeInvoice));
  } catch (err) {
    console.error('Erreur /billit/sales:', err.message);
    res.status(502).json({ error: err.message });
  }
});

// GET /billit/purchases
app.get('/billit/purchases', async (req, res) => {
  try {
    const { from, to } = getQuarterRange();
    const data = await billitFetch('/invoices?type=purchases&dateFrom=' + from + '&dateTo=' + to + '&limit=500');
    const list = Array.isArray(data) ? data : (data.value || data.data || data.items || []);
    res.json(list.map(normalizeInvoice));
  } catch (err) {
    console.error('Erreur /billit/purchases:', err.message);
    res.status(502).json({ error: err.message });
  }
});

// Healthcheck
app.get('/', (req, res) => {
  res.json({ status: 'ok', token_configured: !!BILLIT_TOKEN, quarter: getQuarterRange() });
});

app.listen(PORT, () => {
  console.log('Proxy Billit demarre sur port ' + PORT);
  console.log('Token configure : ' + (BILLIT_TOKEN ? 'OUI' : 'NON'));
});
