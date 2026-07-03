/**
 * Revisão completa do JS Frontend:
 * 
 * NOTA IMPORTANTE SOBRE "CANNOT GET /":
 * Se ao acessar sua URL do Render ou localhost, aparece "CANNOT GET /",
 * significa que o backend (Express) não possui rota '/' definida para GET,
 * ou está rodando na porta errada, ou você abriu direto a porta do backend no navegador.
 * 
 * Para frontend funcionar, você precisa abrir o arquivo .html (Github Pages ou Vite/React no localhost),
 * e não acessar o backend diretamente!
 * 
 * O backend (server.js) deve ter algo assim:
 *     app.get("/", (req, res) => res.send("API do Canal de Comunicação está ativa."));
 * 
 * Se já tem essa rota, e mesmo assim abre "CANNOT GET /", provavelmente você
 * abriu o link direto do Render (backend) e não sua página HTML (frontend).
 * 
 * Então, para usar: entre em https://homa999999.github.io/canal-de-comunicacao/ ou seu frontend local,
 * e NÃO em https://canal-de-comunicacao.onrender.com/
 * 
 * JS abaixo funciona normalmente, só precisa garantir que está acessando o FRONTEND!
 */

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("form");
    const btnEnviar = document.getElementById("btn-enviar");
    const loadingOverlay = document.getElementById("loading-overlay");
    const loadingMessage = document.getElementById("loading-message");

    const fileList = document.getElementById("file-list");
    const inputAnexos = document.getElementById("anexos");

    const COR_PRIMARIA = "#4f46e5";
    const LIMITE_MB = 10;
    const LIMITE_BYTES = LIMITE_MB * 1024 * 1024;
    const MAX_ARQUIVOS = 10;

    function atualizarListaArquivos() {
        if (!inputAnexos?.files?.length) {
            fileList.classList.add("hidden");
            fileList.textContent = "";
            return;
        }

        const nomes = Array.from(inputAnexos.files).map(f => f.name).join(", ");
        fileList.innerHTML = `<i class="fa-solid fa-file-circle-check"></i>${nomes}`;
        fileList.classList.remove("hidden");
    }

    inputAnexos?.addEventListener("change", atualizarListaArquivos);

    function temAnexo() {
        return inputAnexos && inputAnexos.files && inputAnexos.files.length > 0;
    }

    function validarAnexos() {
        const input = form.querySelector('input[name="anexos"]');
        if (!input?.files?.length) return null;

        if (input.files.length > MAX_ARQUIVOS) {
            return `É permitido enviar no máximo ${MAX_ARQUIVOS} arquivos.`;
        }

        for (const file of input.files) {
            if (file.size > LIMITE_BYTES) {
                return `O arquivo "${file.name}" excede o limite de ${LIMITE_MB}MB.`;
            }
        }

        return null;
    }

    function bloquearEnvio() {
        btnEnviar.disabled = true;
    }

    function desbloquearEnvio() {
        btnEnviar.disabled = false;
    }

    function mostrarLoading() {
        loadingMessage.textContent = temAnexo()
            ? "Como seu comunicado tem um anexo, ele demorará um pouco mais para ser enviado, aguarde."
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

        const erroAnexo = validarAnexos();
        if (erroAnexo) {
            Swal.fire({
                icon: "warning",
                title: "Anexo inválido",
                text: erroAnexo,
                confirmButtonText: "Entendi",
                confirmButtonColor: COR_PRIMARIA
            });
            return;
        }

        const formData = new FormData(form);

        const resposta = document.querySelector('input[name="resposta"]:checked');
        if (resposta) {
            formData.set("desejaResposta", resposta.value);
        }

        mostrarLoading();

        try {
            const res = await fetch("https://canal-de-comunicacao.onrender.com/enviar", {
                method: "POST",
                body: formData,
                mode: "cors", // Garantir CORS no frontend
                // NÃO adicionar headers Content-Type - o browser fará isso com boundary
            });

            // Checar primeiro se response é OK e Content-Type = JSON
            const contentType = res.headers.get("content-type") || "";
            let data = null, rawText = null;

            if (!contentType.includes("application/json")) {
                // O backend retornou HTML ou texto, geralmente erro de infra!
                rawText = await res.text();
                throw new Error(
                    "O servidor respondeu algo inesperado (Content-Type não é JSON). " +
                    "Isto indica provável erro de configuração, rota incorreta, backend caído ou build incompleto. " +
                    "Conteúdo recebido (os primeiros 200 caracteres):\n\n" +
                    rawText.slice(0, 200)
                );
            } else {
                data = await res.json();
            }

            if (!res.ok || !data.sucesso) {
                throw new Error(data.erro || "Falha ao enviar o comunicado.");
            }

            ocultarLoading();

            await Swal.fire({
                icon: "success",
                title: "Comunicado enviado!",
                html: `Seu comunicado foi registrado com sucesso.<br><br><strong>Protocolo:</strong> ${data.protocolo}`,
                confirmButtonText: "OK",
                confirmButtonColor: COR_PRIMARIA
            });

            form.reset();
            atualizarListaArquivos();

        } catch (err) {
            ocultarLoading();

            let explicacao = "";
            if (err.message && err.message.includes("<!DOCTYPE")) {
                explicacao =
                    "\n\n→ O backend possivelmente respondeu uma página HTML ou está fora do ar, retornando o conteúdo padrão. " +
                    "Verifique se o endereço da API está correto, se o back está rodando e se está respondendo res.json().";
            }

            Swal.fire({
                icon: "error",
                title: "Erro ao enviar",
                text: (err.message || "Não foi possível enviar o comunicado. Tente novamente.") + explicacao,
                confirmButtonText: "OK",
                confirmButtonColor: COR_PRIMARIA
            });
        }
    });

    const radios = document.querySelectorAll('input[name="resposta"]');
    const contato = document.getElementById("contato");

    radios.forEach(radio => {
        radio.addEventListener("change", () => {
            if (radio.value === "sim" && radio.checked) {
                contato.classList.remove("hidden");
            } else if (radio.value === "nao" && radio.checked) {
                contato.classList.add("hidden");
            }
        });
    });

    const tiposContato = document.querySelectorAll('input[name="contato"]');
    const campoTelefone = document.getElementById("campoTelefone");
    const campoEmail = document.getElementById("campoEmail");

    tiposContato.forEach(radio => {
        radio.addEventListener("change", () => {
            if (radio.value === "telefone" && radio.checked) {
                campoTelefone.classList.remove("hidden");
                campoEmail.classList.add("hidden");
            }

            if (radio.value === "email" && radio.checked) {
                campoEmail.classList.remove("hidden");
                campoTelefone.classList.add("hidden");
            }
        });
    });
});
