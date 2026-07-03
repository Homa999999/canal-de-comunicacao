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



function arquivoParaBase64(arquivo) {

    return new Promise((resolve, reject) => {

        const reader = new FileReader();

        reader.onload = () => {

            const base64 = String(reader.result).split(",")[1];

            resolve({

                name: arquivo.name,

                mimeType: arquivo.type || "application/octet-stream",

                base64

            });

        };

        reader.onerror = () => reject(new Error(`Erro ao ler o arquivo "${arquivo.name}".`));

        reader.readAsDataURL(arquivo);

    });

}



async function montarPayload(form) {

    const formData = new FormData(form);

    const arquivos = form.querySelector('input[name="anexos"]')?.files || [];



    const anexos = arquivos.length

        ? await Promise.all(Array.from(arquivos).map(arquivoParaBase64))

        : [];



    return {

        nome: formData.get("nome") || "",

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



        mostrarLoading();



        const controller = new AbortController();

        const timeoutMs = 60000;

        const timeout = setTimeout(() => {

            controller.abort();

        }, timeoutMs);



        try {

            const appsScriptUrl = obterUrlAppsScript();

            const payload = await montarPayload(form);

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

                html: `Seu comunicado foi registrado com sucesso.<br><br>`,

                confirmButtonText: "OK",

                confirmButtonColor: COR_PRIMARIA

            });



            form.reset();

            atualizarListaArquivos();



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


