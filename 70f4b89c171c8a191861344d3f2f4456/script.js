function obterUrlAppsScript() {
    const meta = document.querySelector('meta[name="apps-script-url"]');
    const url = meta?.content?.trim() || "";

    if (!url || url.includes("COLE_SUA_URL")) {
        throw new Error(
            "Configure a URL do Google Apps Script na meta tag apps-script-url do index.html."
        );
    }

    return url.replace(/\/$/, "");
}

function escaparHtml(texto) {
    return String(texto)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function arquivoParaBase64(arquivo) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            resolve({
                name: arquivo.name,
                mimeType: arquivo.type || "application/octet-stream",
                base64: String(reader.result).split(",")[1]
            });
        };
        reader.onerror = () => reject(new Error(`Erro ao ler o arquivo "${arquivo.name}".`));
        reader.readAsDataURL(arquivo);
    });
}

async function montarPayload(form, arquivosAnexos) {
    const formData = new FormData(form);
    const anexos = arquivosAnexos.length
        ? await Promise.all(arquivosAnexos.map(arquivoParaBase64))
        : [];

    return {
        tipo: formData.get("tipo") || "",
        descricao: formData.get("descricao") || "",
        anexos
    };
}

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("form");
    const btnEnviar = document.getElementById("btn-enviar");
    const loadingOverlay = document.getElementById("loading-overlay");
    const loadingMessage = document.getElementById("loading-message");
    const fileList = document.getElementById("file-list");
    const inputAnexos = document.getElementById("anexos");
    const textareaDescricao = document.getElementById("descricao");

    const COR_PRIMARIA = "#ffcf00";
    const MAX_IMAGENS = 3;
    const LIMITE_CARACTERES = 500;
    const LIMITE_TOTAL_MB = 23;
    const LIMITE_TOTAL_BYTES = LIMITE_TOTAL_MB * 1024 * 1024;

    function ehImagem(arquivo) {
        return arquivo.type.startsWith("image/");
    }

    function validarDescricao() {
        const texto = textareaDescricao.value.trim();
        if (!texto) {
            return {
                titulo: "Descrição obrigatória",
                texto: "Preencha a descrição do ocorrido."
            };
        }
        if (texto.length > LIMITE_CARACTERES) {
            return {
                titulo: "Descrição muito longa",
                texto: `A descrição tem ${texto.length} caracteres, mas o limite é ${LIMITE_CARACTERES}.`
            };
        }
        return null;
    }

    let arquivosAnexos = [];

    function calcularTamanhoTotal(arquivos) {
        return arquivos.reduce((total, arquivo) => total + arquivo.size, 0);
    }

    function formatarTamanho(bytes) {
        if (bytes >= 1024 * 1024) {
            return (bytes / (1024 * 1024)).toFixed(1) + " MB";
        }
        return Math.max(1, Math.round(bytes / 1024)) + " KB";
    }

    function sincronizarInputArquivos() {
        const dataTransfer = new DataTransfer();
        arquivosAnexos.forEach((arquivo) => dataTransfer.items.add(arquivo));
        inputAnexos.files = dataTransfer.files;
    }

    function limparAnexos() {
        arquivosAnexos = [];
        inputAnexos.value = "";
        renderizarListaArquivos();
    }

    function removerAnexo(indice) {
        arquivosAnexos = arquivosAnexos.filter((_, i) => i !== indice);
        sincronizarInputArquivos();
        renderizarListaArquivos();
    }

    function renderizarListaArquivos() {
        if (!arquivosAnexos.length) {
            fileList.classList.add("hidden");
            fileList.innerHTML = "";
            return;
        }

        const totalBytes = calcularTamanhoTotal(arquivosAnexos);
        const itens = arquivosAnexos.map((arquivo, indice) => `
            <li class="file-item">
                <span class="file-item-info">
                    <i class="fa-solid fa-file-lines" aria-hidden="true"></i>
                    <span class="file-item-name">${escaparHtml(arquivo.name)}</span>
                    <span class="file-item-size">${formatarTamanho(arquivo.size)}</span>
                </span>
                <button type="button" class="btn-remover-anexo" data-index="${indice}" aria-label="Remover ${escaparHtml(arquivo.name)}">
                    <i class="fa-solid fa-xmark" aria-hidden="true"></i>
                </button>
            </li>
        `).join("");

        fileList.innerHTML = `
            <li class="file-list-header">
                <span>${arquivosAnexos.length} imagem(ns) · ${formatarTamanho(totalBytes)} / ${LIMITE_TOTAL_MB} MB</span>
                <button type="button" class="btn-limpar btn-limpar-inline" data-limpar="anexos">
                    <i class="fa-solid fa-xmark"></i> Limpar todos
                </button>
            </li>
            ${itens}
        `;

        fileList.classList.remove("hidden");

        fileList.querySelectorAll(".btn-remover-anexo").forEach((botao) => {
            botao.addEventListener("click", () => removerAnexo(Number(botao.dataset.index)));
        });

        fileList.querySelector('[data-limpar="anexos"]')?.addEventListener("click", limparAnexos);
    }

    function validarAnexos(arquivos) {
        if (!arquivos.length) return null;

        const naoImagem = arquivos.find((arquivo) => !ehImagem(arquivo));
        if (naoImagem) {
            return {
                titulo: "Arquivo inválido",
                texto: `"${naoImagem.name}" não é uma imagem. Envie apenas JPG, PNG, GIF ou WebP.`
            };
        }

        if (arquivos.length > MAX_IMAGENS) {
            return {
                titulo: "Limite de imagens",
                texto: `Você selecionou ${arquivos.length} imagens, mas o máximo permitido é ${MAX_IMAGENS}.`
            };
        }

        const totalBytes = calcularTamanhoTotal(arquivos);
        if (totalBytes > LIMITE_TOTAL_BYTES) {
            const totalMb = (totalBytes / (1024 * 1024)).toFixed(1);
            return {
                titulo: "Anexos excedem o limite",
                texto: `Os arquivos somam ${totalMb} MB, mas o limite total é ${LIMITE_TOTAL_MB} MB.`,
                
            };
        }

        return null;
    }

    function mostrarErroAnexo(erro) {
        Swal.fire({
            icon: "warning",
            title: erro.titulo || "Anexo inválido",
            html: `<p>${erro.texto}</p>`,
            confirmButtonText: "Entendi",
            confirmButtonColor: COR_PRIMARIA
        });
    }

    function adicionarArquivos(novosArquivos) {
        const lista = [...arquivosAnexos, ...Array.from(novosArquivos)];
        const erro = validarAnexos(lista);

        if (erro) {
            mostrarErroAnexo(erro);
            inputAnexos.value = "";
            return;
        }

        arquivosAnexos = lista;
        sincronizarInputArquivos();
        renderizarListaArquivos();
        inputAnexos.value = "";
    }

    function limparCampo(campo) {
        if (campo === "tipo") {
            document.getElementById("tipo").value = "";
            return;
        }
        if (campo === "descricao") {
            textareaDescricao.value = "";
            return;
        }
        if (campo === "anexos") {
            limparAnexos();
        }
    }

    inputAnexos?.addEventListener("change", () => {
        if (inputAnexos.files?.length) {
            adicionarArquivos(inputAnexos.files);
        }
    });

    document.querySelectorAll(".btn-limpar[data-limpar]").forEach((botao) => {
        botao.addEventListener("click", () => limparCampo(botao.dataset.limpar));
    });

    function temAnexo() {
        return arquivosAnexos.length > 0;
    }

    function bloquearEnvio() {
        btnEnviar.disabled = true;
    }

    function desbloquearEnvio() {
        btnEnviar.disabled = false;
    }

    function mostrarLoading() {
        loadingMessage.textContent = temAnexo()
            ? "Como seu comunicado tem anexo(s), o envio pode demorar um pouco mais. Aguarde."
            : "Enviando comunicado, por favor, aguarde.";
        loadingOverlay.classList.remove("hidden");
        loadingOverlay.setAttribute("aria-busy", "true");
        document.body.style.overflow = "hidden";
        bloquearEnvio();
    }

    function ocultarLoading() {
        loadingOverlay.classList.add("hidden");
        loadingOverlay.setAttribute("aria-busy", "false");
        document.body.style.overflow = "";
        desbloquearEnvio();
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const erroDescricao = validarDescricao();
        if (erroDescricao) {
            Swal.fire({
                icon: "warning",
                title: erroDescricao.titulo,
                text: erroDescricao.texto,
                confirmButtonText: "Entendi",
                confirmButtonColor: COR_PRIMARIA
            });
            return;
        }

        const erroAnexo = validarAnexos(arquivosAnexos);
        if (erroAnexo) {
            mostrarErroAnexo(erroAnexo);
            return;
        }

        mostrarLoading();

        const controller = new AbortController();
        const timeoutMs = 60000;
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const appsScriptUrl = obterUrlAppsScript();
            const payload = await montarPayload(form, arquivosAnexos);
            const body = new FormData();
            body.append("data", JSON.stringify(payload));

            const res = await fetch(appsScriptUrl, {
                method: "POST",
                body,
                signal: controller.signal
            });

            clearTimeout(timeout);

            const rawText = await res.text();
            let data;

            try {
                data = JSON.parse(rawText);
            } catch {
                throw new Error(
                    "Resposta inválida do Google Apps Script. Verifique se a implantação está como 'Qualquer pessoa'. " +
                    "Conteúdo recebido: " + rawText.slice(0, 200)
                );
            }

            if (!data.sucesso) {
                throw new Error(data.erro || "Falha ao enviar o comunicado.");
            }

            ocultarLoading();

            await Swal.fire({
                icon: "success",
                title: "Comunicado enviado!",
                html: "Seu comunicado foi registrado com sucesso.",
                confirmButtonText: "OK",
                confirmButtonColor: COR_PRIMARIA
            });

            form.reset();
            limparAnexos();

        } catch (err) {
            clearTimeout(timeout);
            ocultarLoading();

            const mensagem = err.name === "AbortError"
                ? "O envio demorou demais. Tente novamente com arquivos menores."
                : (err.message || "Não foi possível enviar o comunicado. Tente novamente.");

            Swal.fire({
                icon: "error",
                title: "Erro ao enviar",
                text: mensagem,
                confirmButtonText: "OK",
                confirmButtonColor: COR_PRIMARIA
            });
        }
    });
});
