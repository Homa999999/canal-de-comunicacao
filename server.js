require("dotenv").config();
const path = require("path");
const dns = require("dns");
const express = require("express");
const nodemailer = require("nodemailer");
const multer = require("multer");
const cors = require("cors");

const app = express();
const LIMITE_TOTAL_MB = 23;
const LIMITE_TOTAL_BYTES = LIMITE_TOTAL_MB * 1024 * 1024;

app.use(cors({
  origin: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.static(path.join(__dirname)));

app.get("/", (_req, res) => {
  res.send("API do Canal de Comunicação está ativa.");
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: LIMITE_TOTAL_BYTES,
    files: 3
  }
});

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "mail.antor.com.br",
  port: Number(process.env.SMTP_PORT) || 465,
  secure: process.env.SMTP_SECURE !== "false",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASSWORD
  },
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 30000,
  lookup: (hostname, _options, callback) => {
    dns.lookup(hostname, { family: 4 }, callback);
  }
});

const EMAIL_DESTINOS = [
  "rh@antor.com.br",
  "marcelo@antor.com.br"
];

function montarTextoEmail({ dataHora, tipo, descricao }) {
  return [
    "Nova Manifestação Recebida",
    "",
    `Data/Hora: ${dataHora}`,
    `Tipo: ${tipo}`,
    "",
    "Descrição:",
    descricao
  ].join("\n");
}

async function enviarEmailViaResend({ subject, text, html, attachments }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || `Ouvidoria Antor <${process.env.EMAIL}>`,
      to: EMAIL_DESTINOS,
      subject,
      text,
      html,
      attachments: attachments.map((anexo) => ({
        filename: anexo.filename,
        content: anexo.content.toString("base64")
      }))
    })
  });

  const payload = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(payload.message || `Falha ao enviar via Resend (HTTP ${res.status}).`);
  }
}

async function enviarEmailViaSmtp(mailOptions) {
  const TIMEOUT_MS = 45000;

  await Promise.race([
    transporter.sendMail(mailOptions),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(
        process.env.RENDER
          ? "O Render gratuito bloqueia SMTP (portas 465/587). Configure RESEND_API_KEY no painel do Render."
          : "Timeout ao enviar e-mail (SMTP fora do ar?)."
      )), TIMEOUT_MS)
    )
  ]);
}

async function enviarEmail({ subject, text, html, attachments }) {
  if (process.env.RESEND_API_KEY) {
    return enviarEmailViaResend({ subject, text, html, attachments });
  }

  return enviarEmailViaSmtp({
    from: `"Ouvidoria Antor" <${process.env.EMAIL}>`,
    to: EMAIL_DESTINOS,
    subject,
    text,
    html,
    attachments
  });
}

// 4. Funções auxiliares (inalteradas)
function formatarDataHora() {
  const [data, hora] = new Date()
    .toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo" })
    .split(" ");
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano} - ${hora}`;
}

function escaparHtml(texto = "") {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\n/g, "<br>");
}

function montarEmailHtml({ dataHora, tipo, descricao, anexos }) {
  // ... igual ao original
  const listaAnexos = anexos.length > 0
    ? anexos.map(a => `
            <tr>
                <td style="padding:6px 0; font-size:14px; color:#475569;">
                    <span style="display:inline-block; width:8px; height:8px; background:#ffcf00; border-radius:50%; margin-right:8px;"></span>
                    ${escaparHtml(a.filename)}
                </td>
            </tr>
        `).join("")
    : "";

  const blocoAnexos = anexos.length > 0 ? `
        <tr>
            <td style="padding:0 32px 24px;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb; border-radius:12px; border:1px solid #ffe566;">
                    <tr>
                        <td style="padding:16px 20px;">
                            <p style="margin:0 0 10px; font-size:12px; font-weight:700; color:#e6b800; text-transform:uppercase; letter-spacing:0.06em;">Anexos (${anexos.length})</p>
                            <table width="100%" cellpadding="0" cellspacing="0">${listaAnexos}</table>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    ` : "";

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <body style="margin:0; padding:0; background:#f1f5f9; font-family:'Segoe UI',Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9; padding:32px 16px;">
            <tr>
                <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(79,70,229,0.1);">
                        <tr>
                            <td style="background:linear-gradient(135deg,#ffcf00 0%,#ffb800 100%); padding:32px;">
                                <p style="margin:0 0 6px; font-size:12px; font-weight:600; color:rgba(30,41,59,0.75); text-transform:uppercase; letter-spacing:0.1em;">Canal NR1</p>
                                <h1 style="margin:0; font-size:24px; font-weight:700; color:#1e293b; letter-spacing:-0.02em;">Novo comunicado recebido</h1>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:28px 32px 8px;">
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td width="50%" style="padding:0 8px 16px 0; vertical-align:top;">
                                            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc; border-radius:12px; border:1px solid #e2e8f0;">
                                                <tr>
                                                    <td style="padding:14px 16px;">
                                                        <p style="margin:0 0 4px; font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em;">Data / Hora</p>
                                                        <p style="margin:0; font-size:14px; font-weight:600; color:#1e293b;">${escaparHtml(dataHora)}</p>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                        <td width="50%" style="padding:0 0 16px 8px; vertical-align:top;">
                                            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc; border-radius:12px; border:1px solid #e2e8f0;">
                                                <tr>
                                                    <td style="padding:14px 16px;">
                                                        <p style="margin:0 0 4px; font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em;">Tipo</p>
                                                        <p style="margin:0; font-size:14px; font-weight:600; color:#1e293b;">${escaparHtml(tipo)}</p>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding:0 32px 24px;">
                                <p style="margin:0 0 10px; font-size:12px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em;">Descrição</p>
                                <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc; border-radius:12px; border-left:4px solid #ffcf00;">
                                    <tr>
                                        <td style="padding:18px 20px; font-size:15px; line-height:1.7; color:#334155;">
                                            ${escaparHtml(descricao)}
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        ${blocoAnexos}
                        <tr>
                            <td style="padding:20px 32px 28px; border-top:1px solid #f1f5f9;">
                                <p style="margin:0; font-size:12px; color:#94a3b8; text-align:center; line-height:1.5;">
                                    E-mail gerado automaticamente pelo Canal de Denúncias NR1
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;
}

// 5. Rota POST /enviar revisada
// IMPORTANTE: Corrigir req ficar pending para sempre (problema comum ao misturar callback e async).
// Uso do padrão Promise para Multer para garantir resposta mesmo em erro.
app.post("/enviar", (req, res) => {
  // Promisificar o Multer
  upload.array("anexos", 10)(req, res, async (err) => {
    let responseSent = false;
    function safeJson(status, body) {
      if (!responseSent) {
        responseSent = true;
        res.status(status).json(body);
      }
    }
    // Tratamento do erro do Multer
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return safeJson(400, {
          sucesso: false,
          erro: `Um dos arquivos excede o limite total de ${LIMITE_TOTAL_MB}MB.`
        });
      }
      if (err.code === "LIMIT_FILE_COUNT") {
        return safeJson(400, {
          sucesso: false,
          erro: "É permitido enviar no máximo 10 arquivos."
        });
      }
      // Para outros erros do multer
      return safeJson(400, {
        sucesso: false,
        erro: err.message || "Erro ao processar os anexos."
      });
    }

    try {
      const dataHora = formatarDataHora();

      const {
        tipo,
        descricao,
        desejaResposta,
        contato
      } = req.body;

      const anexos = (req.files || []).map(file => ({
        filename: file.originalname,
        content: file.buffer
      }));

      const tamanhoTotal = (req.files || []).reduce((total, file) => total + file.size, 0);
      if (tamanhoTotal > LIMITE_TOTAL_BYTES) {
        return safeJson(400, {
          sucesso: false,
          erro: `Os anexos somam mais de ${LIMITE_TOTAL_MB}MB no total. Remova arquivos ou envie versões menores.`
        });
      }

      // Validação mínima
      if (!tipo || !descricao) {
        return safeJson(400, {
          sucesso: false,
          erro: "Tipo e descrição são obrigatórios."
        });
      }

      if (descricao.length > 500) {
        return safeJson(400, {
          sucesso: false,
          erro: "A descrição excede o limite de 500 caracteres."
        });
      }

      if ((req.files || []).length > 3) {
        return safeJson(400, {
          sucesso: false,
          erro: "É permitido enviar no máximo 3 imagens."
        });
      }

      const html = montarEmailHtml({
          dataHora,
          tipo,
          descricao,
          anexos
        });

      await enviarEmail({
        subject: `Nova manifestação - ${tipo}`,
        text: montarTextoEmail({ dataHora, tipo, descricao }),
        html,
        attachments: anexos
      });

      return safeJson(200, {
        sucesso: true
      });

    } catch (erro) {
      // Inclua mensagem de erro técnica SOMENTE para debug.
      // Em produção, preferencialmente enviar apenas uma msg genérica.
      console.error(erro);
      return safeJson(500, {
        sucesso: false,
        erro: erro && erro.message
          ? String(erro.message)
          : "Erro interno ao enviar e-mail."
      });
    }
  });
});

// 6. Inicialização do servidor
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);

  if (process.env.RENDER && !process.env.RESEND_API_KEY) {
    console.warn(
      "AVISO: Render gratuito bloqueia SMTP. Configure RESEND_API_KEY (e RESEND_FROM) no painel do Render."
    );
  }
});