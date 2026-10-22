# Perfumes do Ge — loja virtual

Site responsivo em português, catálogo gerenciado no servidor, três fotos HTTPS por perfume, preços e estoque, carrinho, WhatsApp 5531997784147 e Checkout Pro Mercado Pago.

## Executar localmente
1. Instale Node.js 20 ou superior.
2. Execute `npm install`.
3. Copie `.env.example` para `.env` e defina uma senha de administração longa e exclusiva.
4. Execute `npm start` e abra `http://localhost:3000`.
5. Abra a área administrativa no fim da página para cadastrar produtos, preços e três URLs HTTPS de fotos autorizadas.

## Publicar
Hospede como serviço web Node.js (build: `npm install`, start: `npm start`) com HTTPS. Configure `ADMIN_PASSWORD`, `PUBLIC_BASE_URL`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` como variáveis de ambiente privadas. **Nunca coloque o Access Token no HTML, GitHub ou chat.**

**Persistência:** `data.json` guarda catálogo e pedidos. É obrigatório configurar `DATA_FILE` para um volume persistente com backups; sistemas de arquivos efêmeros (inclusive muitos planos gratuitos) apagam dados em reinícios/redeploys. Para produção comercial, migre para banco de dados transacional com backups, controle de concorrência e reserva de estoque. Não publique como loja real sem isso.

## Mercado Pago
Use as credenciais de teste primeiro. Configure Webhook de pagamentos no painel apontando para `https://SEU-DOMINIO/api/webhook/mercadopago`, habilite assinatura secreta e use o segredo em `MP_WEBHOOK_SECRET`. O backend consulta o pagamento na API do Mercado Pago e confere valor, moeda e referência do pedido antes de atualizar o status. A tela de retorno não é comprovante de aprovação. Teste fluxos de aprovação, rejeição, pendência, webhook duplicado e reembolso antes de produção.

## Limitações importantes
Não há domínio ou hospedagem contratados, nem credenciais configuradas. O catálogo começa vazio para evitar preços e fotos inventados. As fotos são cadastradas por URL HTTPS. A versão atual é um **protótipo funcional para implantação e testes**, não uma loja comercial auditada: falta banco de dados transacional, gestão segura de sessões administrativas, limitação de tentativas de senha, frete, política de privacidade/LGPD, emissão fiscal e conciliação completa de estornos. Não configure credenciais de produção até concluir esses itens.
