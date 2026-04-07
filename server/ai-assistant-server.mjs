import http from 'node:http';
import process from 'node:process';

const PORT = Number(process.env.AI_ASSISTANT_PORT || 8787);
const HF_API_KEY = String(process.env.HUGGINGFACE_API_KEY || '').trim();
const HF_MODEL = String(process.env.HUGGINGFACE_MODEL || 'mistralai/Mistral-7B-Instruct-v0.3').trim();

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

const callHuggingFace = async ({ message, context }) => {
    if (!HF_API_KEY) {
        throw new Error('HUGGINGFACE_API_KEY is not configured. Set it before starting the AI server.');
    }

    const prompt = `${buildAssistantInstructions(context)}\n\nUser: ${String(message || '').trim()}\nAssistant:`;

    const requestBody = {
        inputs: prompt,
        parameters: {
            max_new_tokens: 500,
            temperature: 0.6,
            top_p: 0.95,
            repetition_penalty: 1.05,
            return_full_text: false
        }
    };

    const response = await fetch(`https://api-inference.huggingface.co/models/${HF_MODEL}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${HF_API_KEY}`
        },
        body: JSON.stringify(requestBody)
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
        const errorMessage = payload?.error || 'Hugging Face request failed.';
        throw new Error(errorMessage);
    }

    const text =
        (Array.isArray(payload) && payload[0]?.generated_text) ? payload[0].generated_text.trim() :
            (typeof payload?.generated_text === 'string' ? payload.generated_text.trim() : '');

    if (!text) {
        throw new Error('The Hugging Face response did not include readable text output.');
    }

    return {
        reply: text,
        responseId: '', // HF inference API does not return an id
        model: HF_MODEL
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
            configured: Boolean(HF_API_KEY),
            model: HF_MODEL
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

            const result = await callHuggingFace({ message, context: body.context || {} });

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
    console.log(`HF model: ${HF_MODEL}`);
    console.log(`HF configured: ${HF_API_KEY ? 'yes' : 'no'}`);
});
