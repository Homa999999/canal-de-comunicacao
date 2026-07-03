/**
 * Canal de Comunicação NR1 — Google Apps Script
 *
 * 1. Acesse https://script.google.com e crie um projeto novo
 * 2. Cole todo este arquivo em Code.gs
 * 3. Os e-mails são enviados para luquetabagre@gmail.com e andrehoma@uol.com.br
 * 4. Implantação > Nova implantação > App da Web
 *    - Executar como: Eu
 *    - Quem pode acessar: Qualquer pessoa
 * 5. Copie a URL terminada em /exec e cole no index.html (meta apps-script-url)
 */

const EMAIL_DESTINOS = "luquetabagre@gmail.com,andrehoma@uol.com.br";

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, mensagem: "Canal NR1 ativo. Use POST." }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    if (!e || !e.parameter || !e.parameter.data) {
      throw new Error("Dados do formulário não recebidos.");
    }

    const data = JSON.parse(e.parameter.data);
    const nome = data.nome || "";
    const tipo = data.tipo || "";
    const descricao = data.descricao || "";
    const anexosPayload = data.anexos || [];

    if (!tipo || !descricao) {
      return respostaJson({ sucesso: false, erro: "Tipo e descrição são obrigatórios." }, 400);
    }

    const dataHora = formatarDataHora();

    const blobsAnexo = anexosPayload.map(function (anexo) {
      return Utilities.newBlob(
        Utilities.base64Decode(anexo.base64),
        anexo.mimeType || "application/octet-stream",
        anexo.name || "anexo"
      );
    });

    const nomesAnexos = anexosPayload.map(function (a) {
      return { filename: a.name || "anexo" };
    });

    const assunto = "Nova manifestação - " + tipo;
    const texto = montarTextoEmail({ dataHora, nome, tipo, descricao });
    const html = montarEmailHtml({
      dataHora,
      nome,
      tipo,
      descricao,
      anexos: nomesAnexos
    });

    GmailApp.sendEmail(EMAIL_DESTINOS, assunto, texto, {
      htmlBody: html,
      attachments: blobsAnexo,
      name: "Canal de Denúncias"
    });

    return respostaJson({ sucesso: true });
  } catch (erro) {
    return respostaJson({
      sucesso: false,
      erro: erro && erro.message ? erro.message : String(erro)
    }, 500);
  }
}

function respostaJson(objeto, _codigo) {
  return ContentService
    .createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}

function formatarDataHora() {
  const agora = new Date();
  const fuso = "America/Sao_Paulo";
  const data = Utilities.formatDate(agora, fuso, "dd/MM/yyyy");
  const hora = Utilities.formatDate(agora, fuso, "HH:mm:ss");
  return data + " - " + hora;
}

function escaparHtml(texto) {
  return String(texto || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\n/g, "<br>");
}

function montarTextoEmail(dados) {
  return [
    "Nova Manifestação Recebida",
    "",
    "Data/Hora: " + dados.dataHora,
    "Nome: " + (dados.nome || "Não informado"),
    "Tipo: " + dados.tipo,
    "",
    "Descrição:",
    dados.descricao
  ].join("\n");
}

function montarEmailHtml(dados) {
  const listaAnexos = dados.anexos.length > 0
    ? dados.anexos.map(function (a) {
      return [
        "<tr>",
        '<td style="padding:6px 0; font-size:14px; color:#475569;">',
        '<span style="display:inline-block; width:8px; height:8px; background:#7c3aed; border-radius:50%; margin-right:8px;"></span>',
        escaparHtml(a.filename),
        "</td>",
        "</tr>"
      ].join("");
    }).join("")
    : "";

  const blocoAnexos = dados.anexos.length > 0
    ? [
      "<tr>",
      '<td style="padding:0 32px 24px;">',
      '<table width="100%" cellpadding="0" cellspacing="0" style="background:#faf5ff; border-radius:12px; border:1px solid #ede9fe;">',
      "<tr>",
      '<td style="padding:16px 20px;">',
      '<p style="margin:0 0 10px; font-size:12px; font-weight:700; color:#7c3aed; text-transform:uppercase; letter-spacing:0.06em;">Anexos (' + dados.anexos.length + ")</p>",
      '<table width="100%" cellpadding="0" cellspacing="0">' + listaAnexos + "</table>",
      "</td>",
      "</tr>",
      "</table>",
      "</td>",
      "</tr>"
    ].join("")
    : "";

  return [
    "<!DOCTYPE html>",
    '<html lang="pt-BR">',
    '<body style="margin:0; padding:0; background:#f1f5f9; font-family:\'Segoe UI\',Arial,sans-serif;">',
    '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9; padding:32px 16px;">',
    "<tr>",
    '<td align="center">',
    '<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(79,70,229,0.1);">',
    "<tr>",
    '<td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%); padding:32px;">',
    '<p style="margin:0 0 6px; font-size:12px; font-weight:600; color:rgba(255,255,255,0.75); text-transform:uppercase; letter-spacing:0.1em;">Canal NR1</p>',
    '<h1 style="margin:0; font-size:24px; font-weight:700; color:#ffffff;">Nova comunicado recebido</h1>',
    "</td>",
    "</tr>",
    "<tr>",
    '<td style="padding:28px 32px 8px;">',
    '<p style="margin:0 0 4px; font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase;">Data / Hora</p>',
    '<p style="margin:0 0 16px; font-size:14px; color:#1e293b;">' + escaparHtml(dados.dataHora) + "</p>",
    '<p style="margin:0 0 4px; font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase;">Nome</p>',
    '<p style="margin:0 0 16px; font-size:14px; color:#1e293b;">' + escaparHtml(dados.nome || "Não informado") + "</p>",
    '<p style="margin:0 0 4px; font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase;">Tipo</p>',
    '<p style="margin:0 0 16px; font-size:14px; color:#1e293b;">' + escaparHtml(dados.tipo) + "</p>",
    "</td>",
    "</tr>",
    "<tr>",
    '<td style="padding:0 32px 24px;">',
    '<p style="margin:0 0 10px; font-size:12px; font-weight:700; color:#94a3b8; text-transform:uppercase;">Descrição</p>',
    '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc; border-radius:12px; border-left:4px solid #4f46e5;">',
    "<tr>",
    '<td style="padding:18px 20px; font-size:15px; line-height:1.7; color:#334155;">',
    escaparHtml(dados.descricao),
    "</td>",
    "</tr>",
    "</table>",
    "</td>",
    "</tr>",
    blocoAnexos,
    "<tr>",
    '<td style="padding:20px 32px 28px; border-top:1px solid #f1f5f9;">',
    '<p style="margin:0; font-size:12px; color:#94a3b8; text-align:center;">E-mail gerado automaticamente pelo Canal de Denúncias NR1</p>',
    "</td>",
    "</tr>",
    "</table>",
    "</td>",
    "</tr>",
    "</table>",
    "</body>",
    "</html>"
  ].join("");
}
