import http from 'node:http';
import process from 'node:process';

const PORT = Number(process.env.AI_ASSISTANT_PORT || 8787);
const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || '').trim();
const OPENAI_MODEL = String(process.env.OPENAI_MODEL || 'gpt-5.4').trim();
const OPENAI_REASONING_EFFORT = String(process.env.OPENAI_REASONING_EFFORT || 'medium').trim();

const sendJson = (response, statusCode, payload) => {
    response.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
    });
    response.end(JSON.stringify(payload));
};

const readJsonBody = async (request) => {
    const chunks = [];

    for await (const chunk of request) {
        chunks.push(chunk);
    }

    const rawBody = Buffer.concat(chunks).toString('utf8');
    return rawBody ? JSON.parse(rawBody) : {};
};

const formatCurrency = (value) => `KSh ${Number(value || 0).toLocaleString()}`;

const buildCatalogSummary = (products = []) => {
    if (!Array.isArray(products) || products.length === 0) {
        return 'No product catalog context is available right now.';
    }

    return products
        .slice(0, 80)
        .map((product) => (
            `- ${product.name} | category: ${product.category} | price: ${formatCurrency(product.price)} | stock: ${product.stock} | featured: ${product.featured ? 'yes' : 'no'}`
        ))
        .join('\n');
};

const buildOrdersSummary = (orders = []) => {
    if (!Array.isArray(orders) || orders.length === 0) {
        return 'The signed-in user has no order history in the provided context.';
    }

    return orders
        .slice(0, 10)
        .map((order) => (
            `- order #${String(order.id).slice(0, 8)} | status: ${order.status} | total: ${formatCurrency(order.total)} | city: ${order.city || 'not set'} | items: ${order.itemCount}`
        ))
        .join('\n');
};

const buildCartSummary = (cart = []) => {
    if (!Array.isArray(cart) || cart.length === 0) {
        return 'The user cart is currently empty.';
    }

    return cart
        .slice(0, 20)
        .map((item) => (
            `- ${item.name} | quantity: ${item.quantity} | price: ${formatCurrency(item.price)}`
        ))
        .join('\n');
};

const buildAssistantInstructions = (context = {}) => {
    const userLabel = context.user?.email || 'guest';
    const profileLabel = context.profile
        ? `${context.profile.accountType || 'unknown account'}, role=${context.profile.role || 'unknown'}, accessRole=${context.profile.accessRole || 'customer'}`
        : 'guest visitor';

    return [
        'You are Zack Ecommerce AI, a reliable shopping assistant for Zack Ecommerce.',
        'Your answers should feel calm, helpful, and trustworthy, similar in quality and clarity to ChatGPT.',
        'Only present product names, prices, stock levels, category assignments, order statuses, and cart contents that appear in the supplied context.',
        'If the context does not contain an exact fact, say that you do not have enough confirmed store data and guide the user to the correct page instead of guessing.',
        'Keep answers concise, direct, and practical. Use short bullets or compact paragraphs when useful.',
        'You may help with product discovery, category suggestions, budget picks, cart guidance, M-Pesa checkout explanations, delivery guidance, and order tracking.',
        'If the user asks a general question unrelated to the store, respond briefly and redirect to Zack Ecommerce shopping help.',
        'When helpful, point users to these routes: /categories, /cart, /checkout, /dashboard/orders, /dashboard/settings, /admin.',
        '',
        `Current page: ${context.currentPath || '/'}`,
        `Current user: ${userLabel}`,
        `Current profile: ${profileLabel}`,
        '',
        'Catalog snapshot:',
        buildCatalogSummary(context.products),
        '',
        'Cart snapshot:',
        buildCartSummary(context.cart),
        '',
        'Order snapshot:',
        buildOrdersSummary(context.orders)
    ].join('\n');
};

const extractOutputText = (payload) => {
    if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
        return payload.output_text.trim();
    }

    const output = Array.isArray(payload?.output) ? payload.output : [];

    const textParts = output.flatMap((entry) => {
        const content = Array.isArray(entry?.content) ? entry.content : [];
        return content
            .filter((part) => typeof part?.text === 'string')
            .map((part) => part.text.trim())
            .filter(Boolean);
    });

    return textParts.join('\n\n').trim();
};

const callOpenAI = async ({ message, previousResponseId, context }) => {
    if (!OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is not configured. Start the AI server with a valid OpenAI API key.');
    }

    const requestBody = {
        model: OPENAI_MODEL,
        reasoning: {
            effort: OPENAI_REASONING_EFFORT
        },
        store: true,
        instructions: buildAssistantInstructions(context),
        input: String(message || '').trim(),
        max_output_tokens: 500
    };

    if (previousResponseId) {
        requestBody.previous_response_id = previousResponseId;
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify(requestBody)
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
        const errorMessage = payload?.error?.message || 'OpenAI request failed.';
        throw new Error(errorMessage);
    }

    const reply = extractOutputText(payload);
    if (!reply) {
        throw new Error('The AI response did not include readable text output.');
    }

    return {
        reply,
        responseId: payload.id || '',
        model: payload.model || OPENAI_MODEL
    };
};

const server = http.createServer(async (request, response) => {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

    if (request.method === 'OPTIONS') {
        sendJson(response, 204, {});
        return;
    }

    if (request.method === 'GET' && url.pathname === '/api/assistant/health') {
        sendJson(response, 200, {
            ok: true,
            configured: Boolean(OPENAI_API_KEY),
            model: OPENAI_MODEL
        });
        return;
    }

    if (request.method === 'POST' && url.pathname === '/api/assistant') {
        try {
            const body = await readJsonBody(request);
            const message = String(body.message || '').trim();

            if (!message) {
                sendJson(response, 400, { error: 'A message is required.' });
                return;
            }

            const result = await callOpenAI({
                message,
                previousResponseId: String(body.previousResponseId || '').trim(),
                context: body.context || {}
            });

            sendJson(response, 200, result);
        } catch (error) {
            console.error('AI assistant request failed:', error);
            sendJson(response, 500, {
                error: error.message || 'AI assistant request failed.'
            });
        }
        return;
    }

    sendJson(response, 404, { error: 'Not found.' });
});

server.listen(PORT, () => {
    console.log(`Zack Ecommerce AI server listening on http://localhost:${PORT}`);
    console.log(`OpenAI model: ${OPENAI_MODEL}`);
    console.log(`OpenAI configured: ${OPENAI_API_KEY ? 'yes' : 'no'}`);
});
