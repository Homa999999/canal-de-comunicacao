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
                body: formData
            });

            const data = await res.json();

            if (!res.ok || !data.sucesso) {
                throw new Error(data.erro || "Falha no envio");
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
            return res.status(500).json({
                sucesso: false,
                erro: "Erro interno"
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
