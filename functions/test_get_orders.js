const axios = require('axios');

const OLIST_TOKEN = "efb2bf1068997a0ca4c2ce9d5009482ddf86520fcfafaaafbc0d00b758299c39";
const TINY_API_BASE_URL = "https://api.tiny.com.br/api2";

async function testGetOrders() {
    console.log("=== Testando Busca de Pedidos por CPF ===\n");

    // CPF de teste (pode não ter pedidos, mas queremos ver a estrutura)
    // Vou usar um CPF que sei que existe nos contatos criados se possível, ou um genérico
    const cpfTeste = "11111111111";

    try {
        const response = await axios.post(`${TINY_API_BASE_URL}/pedidos.pesquisa.php`, null, {
            params: {
                token: OLIST_TOKEN,
                cpf_cnpj: cpfTeste,
                formato: "json"
            }
        });

        console.log("Resposta completa:", JSON.stringify(response.data, null, 2));

        if (response.data.retorno.status === "OK") {
            const pedidos = response.data.retorno.pedidos;
            console.log(`\nEncontrados ${pedidos.length} pedidos.`);

            // Se tiver pedidos, vamos tentar pegar os detalhes do primeiro para ver os itens
            if (pedidos.length > 0) {
                const idPedido = pedidos[0].pedido.id;
                console.log(`\nBuscando detalhes do pedido ${idPedido}...`);

                const responseDetalhe = await axios.post(`${TINY_API_BASE_URL}/pedido.obter.php`, null, {
                    params: {
                        token: OLIST_TOKEN,
                        id: idPedido,
                        formato: "json"
                    }
                });
                console.log("Detalhes do pedido:", JSON.stringify(responseDetalhe.data, null, 2));
            }
        } else {
            console.log("Status não OK:", response.data.retorno.status);
        }

    } catch (error) {
        console.error("Erro:", error.message);
        if (error.response) {
            console.error("Resposta:", error.response.data);
        }
    }
}

testGetOrders();
