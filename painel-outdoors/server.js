// server.js

const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(session({
  secret: 'chave-secreta',
  resave: false,
  saveUninitialized: true
}));

const STATUS_FILE = path.join(__dirname, 'data/status.json');
const CLIENTES_FILE = path.join(__dirname, 'data/clientes.json');
const FORNECEDORES_FILE = path.join(__dirname, 'data/fornecedores.json');

function garantirArquivo(file, conteudoInicial) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(conteudoInicial, null, 2));
  }
}
garantirArquivo(STATUS_FILE, {});
garantirArquivo(CLIENTES_FILE, {});
garantirArquivo(FORNECEDORES_FILE, {});

function carregarJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file));
  } catch {
    return {};
  }
}

function salvarJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Usuário fixo
const USUARIO = 'atendimento';
const SENHA = '9937';

// Login
app.post('/api/login', (req, res) => {
  const { usuario, senha } = req.body;
  if (usuario === USUARIO && senha === SENHA) {
    req.session.logado = true;
    res.sendStatus(200);
  } else {
    res.sendStatus(401);
  }
});

app.get('/api/check-auth', (req, res) => {
  if (req.session.logado) {
    res.sendStatus(200);
  } else {
    res.sendStatus(401);
  }
});

// Status
app.get('/api/status', (req, res) => {
  res.json(carregarJSON(STATUS_FILE));
});

app.post('/api/status', (req, res) => {
  const { bisemana, outdoorId, ocupado } = req.body;
  const statusData = carregarJSON(STATUS_FILE);
  if (!statusData[bisemana]) statusData[bisemana] = {};
  statusData[bisemana][outdoorId] = ocupado;
  salvarJSON(STATUS_FILE, statusData);
  res.sendStatus(200);
});

// Clientes
app.get('/api/clientes', (req, res) => {
  res.json(carregarJSON(CLIENTES_FILE));
});

app.post('/api/clientes', (req, res) => {
  const { bisemana, outdoorId, cliente } = req.body;
  const clientesData = carregarJSON(CLIENTES_FILE);
  if (!clientesData[bisemana]) clientesData[bisemana] = {};
  clientesData[bisemana][outdoorId] = cliente;
  salvarJSON(CLIENTES_FILE, clientesData);
  res.sendStatus(200);
});

// Fornecedores
app.get('/api/fornecedores', (req, res) => {
  res.json(carregarJSON(FORNECEDORES_FILE));
});

app.post('/api/fornecedores', (req, res) => {
  const { outdoorId, fornecedor } = req.body;
  const fornecedoresData = carregarJSON(FORNECEDORES_FILE);
  fornecedoresData[outdoorId] = fornecedor;
  salvarJSON(FORNECEDORES_FILE, fornecedoresData);
  res.sendStatus(200);
});

// Geração de PDF via Puppeteer
app.post('/api/relatorio', async (req, res) => {
  try {
    // Exemplo básico: gera PDF com uma página HTML simples
    const { bisemana } = req.body;

    // Dados para relatório: status e clientes da bisemana
    const statusData = carregarJSON(STATUS_FILE)[bisemana] || {};
    const clientesData = carregarJSON(CLIENTES_FILE)[bisemana] || {};

    // Montar HTML simples para PDF
    let html = `<h1>Relatório - Bi-semana ${bisemana}</h1>`;
    html += `<table border="1" cellspacing="0" cellpadding="5">
      <thead>
        <tr>
          <th>Outdoor</th>
          <th>Status</th>
          <th>Cliente</th>
        </tr>
      </thead>
      <tbody>`;

    for (const outdoorId of Object.keys(statusData)) {
      html += `<tr>
        <td>${outdoorId}</td>
        <td>${statusData[outdoorId] ? 'Ocupado' : 'Disponível'}</td>
        <td>${clientesData[outdoorId] || '-'}</td>
      </tr>`;
    }

    html += '</tbody></table>';

    // Iniciar Puppeteer para gerar PDF
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });

    await browser.close();

    // Enviar PDF para o cliente
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=relatorio_bisemana_${bisemana}.pdf`,
      'Content-Length': pdfBuffer.length,
    });

    res.send(pdfBuffer);
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    res.status(500).send('Erro ao gerar PDF');
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
