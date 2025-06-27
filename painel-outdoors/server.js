// Atualização para usuário e senha

const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'michelly123',
  resave: false,
  saveUninitialized: true
}));

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const loadJSON = (filename) => {
  const filePath = path.join(DATA_DIR, filename);
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath));
    } else {
      fs.writeFileSync(filePath, '{}');
      return {};
    }
  } catch (err) {
    console.error(`Erro ao ler ${filename}:`, err);
    return {};
  }
};

const saveJSON = (filename, data) => {
  const filePath = path.join(DATA_DIR, filename);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`Erro ao salvar ${filename}:`, err);
  }
};

let statusData = loadJSON('status.json');
let clientesData = loadJSON('clientes.json');
let fornecedoresData = loadJSON('fornecedores.json');

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Login atualizado
app.post('/login', (req, res) => {
  const { usuario, senha } = req.body;
  if (usuario === 'atendimento' && senha === '9937') {
    req.session.autorizado = true;
    return res.sendStatus(200);
  }
  res.sendStatus(401);
});

app.get('/painel', (req, res) => {
  if (!req.session.autorizado) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/status', (req, res) => res.json(statusData));
app.get('/api/clientes', (req, res) => res.json(clientesData));
app.get('/api/fornecedores', (req, res) => res.json(fornecedoresData));

app.post('/api/status', (req, res) => {
  if (!req.session.autorizado) return res.sendStatus(403);
  const { bisemana, outdoorId, ocupado } = req.body;
  if (!statusData[bisemana]) statusData[bisemana] = {};
  statusData[bisemana][outdoorId] = ocupado;
  saveJSON('status.json', statusData);
  res.sendStatus(200);
});

app.post('/api/clientes', (req, res) => {
  if (!req.session.autorizado) return res.sendStatus(403);
  const { bisemana, outdoorId, cliente } = req.body;
  if (!clientesData[bisemana]) clientesData[bisemana] = {};
  clientesData[bisemana][outdoorId] = cliente;
  saveJSON('clientes.json', clientesData);
  res.sendStatus(200);
});

app.post('/api/fornecedores', (req, res) => {
  if (!req.session.autorizado) return res.sendStatus(403);
  const { outdoorId, fornecedor } = req.body;
  fornecedoresData[outdoorId] = fornecedor;
  saveJSON('fornecedores.json', fornecedoresData);
  res.sendStatus(200);
});

app.post('/api/relatorio', (req, res) => {
  const { bisemanas, filtroStatus } = req.body;
  const bisemana = bisemanas[0];

  const doc = new PDFDocument({ size: 'A4', margins: { top: 40, left: 40, right: 40, bottom: 40 } });
  res.setHeader('Content-Disposition', `attachment; filename=relatorio_outdoors_bisemana_${bisemana}.pdf`);
  res.setHeader('Content-Type', 'application/pdf');
  doc.pipe(res);

  const outdoorsPath = path.join(__dirname, 'public', 'outdoors.json');
  const outdoors = JSON.parse(fs.readFileSync(outdoorsPath, 'utf8'));

  doc.font('Helvetica-Bold').fontSize(16).text(`Relatório de Outdoors - Bi-semana ${bisemana}`, { align: 'center' });
  doc.moveDown(1);

  const marginLeft = 40;
  const marginRight = 40;
  const pageWidth = doc.page.width - marginLeft - marginRight;
  const colWidths = {
    nome: 100,
    endereco: 220,
    status: 80,
    cliente: pageWidth - (100 + 220 + 80),
  };
  const defaultRowHeight = 20;
  let y = doc.y;

  function desenharCabecalho(yPos) {
    doc.rect(marginLeft, yPos, pageWidth, defaultRowHeight).fill('#34495e').stroke();
    doc.fillColor('white').font('Helvetica-Bold').fontSize(12);
    doc.text('Outdoor', marginLeft + 5, yPos + 5, { width: colWidths.nome });
    doc.text('Endereço', marginLeft + colWidths.nome + 5, yPos + 5, { width: colWidths.endereco });
    doc.text('Status', marginLeft + colWidths.nome + colWidths.endereco + 5, yPos + 5, { width: colWidths.status });
    doc.text('Cliente', marginLeft + colWidths.nome + colWidths.endereco + colWidths.status + 5, yPos + 5, { width: colWidths.cliente });
    doc.fillColor('black').font('Helvetica').fontSize(11);
  }

  desenharCabecalho(y);
  y += defaultRowHeight;

  outdoors.forEach(out => {
    const ocupado = !!(statusData[bisemana]?.[out.id]);
    if (filtroStatus === 'ocupados' && !ocupado) return;
    if (filtroStatus === 'disponiveis' && ocupado) return;

    const cliente = clientesData[bisemana]?.[out.id] || '';
    const nomeHeight = doc.heightOfString(out.nome, { width: colWidths.nome - 10 });
    const enderecoHeight = doc.heightOfString(out.endereco, { width: colWidths.endereco - 10 });
    const clienteHeight = doc.heightOfString(cliente, { width: colWidths.cliente - 10 });
    const rowHeight = Math.max(nomeHeight, enderecoHeight, clienteHeight, defaultRowHeight) + 6;

    if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = doc.page.margins.top;
      desenharCabecalho(y);
      y += defaultRowHeight;
    }

    doc.rect(marginLeft, y, pageWidth, rowHeight).fill('#f9f9f9').stroke();
    doc.fillColor('black');

    doc.text(out.nome, marginLeft + 5, y + 3, { width: colWidths.nome - 10 });
    doc.text(out.endereco, marginLeft + colWidths.nome + 5, y + 3, { width: colWidths.endereco - 10 });

    const statusText = ocupado ? 'Ocupado' : 'Disponível';
    const corStatus = ocupado ? 'red' : 'green';

    doc.fillColor(corStatus).text(statusText, marginLeft + colWidths.nome + colWidths.endereco + 5, y + 3, {
      width: colWidths.status - 10,
      align: 'center',
    });

    doc.fillColor('black').text(cliente, marginLeft + colWidths.nome + colWidths.endereco + colWidths.status + 5, y + 3, {
      width: colWidths.cliente - 10,
    });

    y += rowHeight;
  });

  doc.end();
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
