const KEYWORD_GROUPS = {
    greeting: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'],
    featured: ['featured', 'latest', 'new arrival', 'new arrivals', 'popular', 'best seller', 'best sellers', 'recommend'],
    payment: ['mpesa', 'm-pesa', 'payment', 'pay', 'stk'],
    delivery: ['delivery', 'shipping', 'ship', 'location', 'address'],
    order: ['order', 'orders', 'track', 'tracking', 'status', 'history'],
    cart: ['cart', 'basket', 'checkout'],
    admin: ['admin', 'dashboard', 'manage', 'inventory', 'analytics']
};

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const tokenize = (value) => normalizeText(value)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1);

const hasKeyword = (text, keywords) => keywords.some((keyword) => text.includes(keyword));

const formatMoney = (value) => `KSh ${Number(value || 0).toLocaleString()}`;

const uniqueBy = (items, key) => {
    const seen = new Set();
    return items.filter((item) => {
        const value = item[key];
        if (seen.has(value)) return false;
        seen.add(value);
        return true;
    });
};

const buildPromptSuggestion = (label, value) => ({
    type: 'prompt',
    label,
    value
});

const buildLinkSuggestion = (label, href) => ({
    type: 'link',
    label,
    href
});

const createMessage = (role, content, options = {}) => ({
    id: options.id || `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content,
    suggestions: options.suggestions || [],
    timestamp: options.timestamp || Date.now()
});

const getFeaturedProducts = (products) => {
    const featured = products.filter((product) => product.featured);
    return featured.length > 0 ? featured : products.slice(0, 4);
};

const getLatestProducts = (products) => {
    return [...products]
        .sort((a, b) => {
            const aTime = a.created_at instanceof Date ? a.created_at.getTime() : 0;
            const bTime = b.created_at instanceof Date ? b.created_at.getTime() : 0;
            return bTime - aTime;
        })
        .slice(0, 4);
};

const scoreProductMatch = (product, tokens) => {
    const name = normalizeText(product.name);
    const category = normalizeText(product.category);
    const description = normalizeText(product.description);

    return tokens.reduce((score, token) => {
        let nextScore = score;
        if (name.includes(token)) nextScore += 4;
        if (category.includes(token)) nextScore += 3;
        if (description.includes(token)) nextScore += 1;
        return nextScore;
    }, 0);
};

const findMatchingProducts = (products, prompt) => {
    const tokens = tokenize(prompt);
    if (tokens.length === 0) return [];

    return [...products]
        .map((product) => ({
            product,
            score: scoreProductMatch(product, tokens)
        }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((entry) => entry.product);
};

const getCategoryMatches = (products, prompt) => {
    const text = normalizeText(prompt);
    const categories = uniqueBy(
        products
            .map((product) => ({
                raw: product.category || '',
                normalized: normalizeText(product.category)
            }))
            .filter((entry) => entry.normalized),
        'normalized'
    );

    const matchingCategories = categories.filter((category) => text.includes(category.normalized));
    if (matchingCategories.length === 0) return [];

    return products.filter((product) => matchingCategories.some((category) => normalizeText(product.category) === category.normalized));
};

const extractBudget = (prompt) => {
    const match = normalizeText(prompt).match(/(?:ksh|kes)?\s*([\d,]{3,})/i);
    if (!match) return null;

    const parsed = Number(match[1].replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
};

const buildProductSummary = (products, limit = 3) => {
    return products.slice(0, limit).map((product) => (
        `- ${product.name} (${product.category}) - ${formatMoney(product.price)}`
    )).join('\n');
};

const buildProductSuggestions = (products, limit = 3) => {
    return products.slice(0, limit).map((product) => buildLinkSuggestion(product.name, `/product/${product.id}`));
};

const buildOrderSummary = (orders) => {
    return orders.slice(0, 3).map((order) => (
        `- Order #${order.id.slice(0, 8)} is ${String(order.status || 'pending').toUpperCase()} at ${formatMoney(order.total)}`
    )).join('\n');
};

export const getInitialAssistantMessages = ({ user, isAdmin, cartCount }) => {
    const content = user
        ? `Hello ${user.displayName || user.email || 'there'}! I am Zack AI and I can help with products, categories, cart questions, M-Pesa checkout, and your order status.`
        : 'Hello! I am Zack AI. I can help you discover products, compare prices, and explain checkout before you sign in.';

    const suggestions = user
        ? [
            buildPromptSuggestion('Show featured products', 'Show me featured products'),
            buildPromptSuggestion('Track my latest order', 'Track my latest order'),
            buildPromptSuggestion('What is in my cart?', 'What is in my cart?'),
            ...(isAdmin ? [buildLinkSuggestion('Open admin', '/admin')] : [])
        ]
        : [
            buildPromptSuggestion('Show featured products', 'Show me featured products'),
            buildPromptSuggestion('Budget picks', 'Recommend products under 5000'),
            buildPromptSuggestion('How does M-Pesa work?', 'How do I pay with M-Pesa?'),
            buildLinkSuggestion('Browse catalog', '/categories')
        ];

    const messages = [createMessage('assistant', content, { suggestions })];

    if (cartCount > 0) {
        messages.push(createMessage(
            'assistant',
            `You already have ${cartCount} item${cartCount === 1 ? '' : 's'} in your cart. I can help you review them or guide you to checkout.`,
            {
                suggestions: [
                    buildPromptSuggestion('Review my cart', 'What is in my cart?'),
                    buildLinkSuggestion('Go to cart', '/cart')
                ]
            }
        ));
    }

    return messages;
};

export const buildAssistantReply = ({
    prompt,
    products = [],
    orders = [],
    cart = [],
    user,
    profile,
    isAdmin
}) => {
    const text = normalizeText(prompt);
    const budget = extractBudget(prompt);
    const categoryMatches = getCategoryMatches(products, prompt);
    const matchedProducts = findMatchingProducts(products, prompt);
    const featuredProducts = getFeaturedProducts(products);
    const latestProducts = getLatestProducts(products);

    if (hasKeyword(text, KEYWORD_GROUPS.greeting)) {
        return createMessage(
            'assistant',
            user
                ? `Hi ${profile?.displayName || user.displayName || 'there'}! Ask me about products, orders, checkout, delivery, or M-Pesa payment.`
                : 'Hi there! Ask me for Zack product recommendations, pricing, categories, delivery information, or how checkout works.',
            {
                suggestions: [
                    buildPromptSuggestion('Featured products', 'Show me featured products'),
                    buildPromptSuggestion('Budget options', 'Recommend products under 3000'),
                    ...(user ? [buildPromptSuggestion('Latest order', 'Track my latest order')] : [buildLinkSuggestion('Login to track orders', '/login')])
                ]
            }
        );
    }

    if (hasKeyword(text, KEYWORD_GROUPS.admin) && isAdmin) {
        return createMessage(
            'assistant',
            'You have admin access. You can manage featured products, update order statuses, review users, and monitor low-stock items from the admin console.',
            {
                suggestions: [
                    buildLinkSuggestion('Open admin console', '/admin'),
                    buildPromptSuggestion('Show low-stock guidance', 'How do I manage low stock?')
                ]
            }
        );
    }

    if (hasKeyword(text, KEYWORD_GROUPS.cart)) {
        if (cart.length === 0) {
            return createMessage(
                'assistant',
                'Your cart is currently empty. I can help you find products to add next.',
                {
                    suggestions: [
                        buildPromptSuggestion('Show featured products', 'Show me featured products'),
                        buildLinkSuggestion('Browse all products', '/categories')
                    ]
                }
            );
        }

        const cartLines = cart.slice(0, 3).map((item) => `- ${item.name} x${item.quantity} at ${formatMoney(item.price)}`).join('\n');
        const total = cart.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.quantity) || 0)), 0);

        return createMessage(
            'assistant',
            `Here is your current cart:\n${cartLines}\n\nEstimated total: ${formatMoney(total)}.`,
            {
                suggestions: [
                    buildLinkSuggestion('Open cart', '/cart'),
                    buildLinkSuggestion('Proceed to checkout', '/checkout')
                ]
            }
        );
    }

    if (hasKeyword(text, KEYWORD_GROUPS.order)) {
        if (!user) {
            return createMessage(
                'assistant',
                'I can help with order tracking once you are signed in. After login, I will show your latest order status and order history.',
                {
                    suggestions: [
                        buildLinkSuggestion('Login', '/login'),
                        buildPromptSuggestion('Show featured products', 'Show me featured products')
                    ]
                }
            );
        }

        if (orders.length === 0) {
            return createMessage(
                'assistant',
                'You do not have any orders yet. I can help you find products and guide you to checkout when you are ready.',
                {
                    suggestions: [
                        buildLinkSuggestion('Browse products', '/categories'),
                        buildLinkSuggestion('Open dashboard', '/dashboard/orders')
                    ]
                }
            );
        }

        return createMessage(
            'assistant',
            `Here are your latest orders:\n${buildOrderSummary(orders)}`,
            {
                suggestions: [
                    buildLinkSuggestion('Open order history', '/dashboard/orders'),
                    buildPromptSuggestion('Explain order statuses', 'What do pending, paid, processing and delivered mean?')
                ]
            }
        );
    }

    if (hasKeyword(text, KEYWORD_GROUPS.payment)) {
        return createMessage(
            'assistant',
            'For M-Pesa checkout, add your products to cart, proceed to checkout, enter your delivery details and phone number, then approve the STK push on your phone. Your order status updates after payment confirmation.',
            {
                suggestions: [
                    buildLinkSuggestion('Go to checkout', '/checkout'),
                    buildPromptSuggestion('Delivery information', 'How does delivery work?')
                ]
            }
        );
    }

    if (hasKeyword(text, KEYWORD_GROUPS.delivery)) {
        return createMessage(
            'assistant',
            'Delivery is handled during checkout. You enter your address and city, review your total including delivery fee, then complete payment. After that, your dashboard shows the latest order status updates.',
            {
                suggestions: [
                    buildLinkSuggestion('Open checkout', '/checkout'),
                    ...(user ? [buildLinkSuggestion('Track my orders', '/dashboard/orders')] : [buildLinkSuggestion('Login for tracking', '/login')])
                ]
            }
        );
    }

    if (hasKeyword(text, KEYWORD_GROUPS.featured)) {
        const picks = featuredProducts.length > 0 ? featuredProducts : latestProducts;
        return createMessage(
            'assistant',
            `These are strong picks right now:\n${buildProductSummary(picks)}`,
            {
                suggestions: [
                    ...buildProductSuggestions(picks),
                    buildLinkSuggestion('See full catalog', '/categories')
                ]
            }
        );
    }

    if (budget) {
        const affordable = (categoryMatches.length > 0 ? categoryMatches : products)
            .filter((product) => Number(product.price) <= budget)
            .slice(0, 4);

        if (affordable.length > 0) {
            return createMessage(
                'assistant',
                `Here are good options under ${formatMoney(budget)}:\n${buildProductSummary(affordable, 4)}`,
                {
                    suggestions: [
                        ...buildProductSuggestions(affordable),
                        buildLinkSuggestion('Browse more', '/categories')
                    ]
                }
            );
        }

        return createMessage(
            'assistant',
            `I could not find products under ${formatMoney(budget)} right now, but I can still show you featured items or category-specific options.`,
            {
                suggestions: [
                    buildPromptSuggestion('Show featured products', 'Show me featured products'),
                    buildLinkSuggestion('Browse all products', '/categories')
                ]
            }
        );
    }

    if (categoryMatches.length > 0) {
        return createMessage(
            'assistant',
            `I found these products in that category:\n${buildProductSummary(categoryMatches, 4)}`,
            {
                suggestions: [
                    ...buildProductSuggestions(categoryMatches, 3),
                    buildLinkSuggestion('Open categories', '/categories')
                ]
            }
        );
    }

    if (matchedProducts.length > 0) {
        return createMessage(
            'assistant',
            `These products look relevant:\n${buildProductSummary(matchedProducts, 4)}`,
            {
                suggestions: [
                    ...buildProductSuggestions(matchedProducts, 3),
                    buildLinkSuggestion('View all results', '/categories')
                ]
            }
        );
    }

    return createMessage(
        'assistant',
        'I can help with featured products, category recommendations, budget picks, cart questions, M-Pesa checkout, and order tracking. Try asking for stationery, featured products, products under a budget, or your latest order.',
        {
            suggestions: [
                buildPromptSuggestion('Featured products', 'Show me featured products'),
                buildPromptSuggestion('Budget picks', 'Recommend products under 5000'),
                buildPromptSuggestion('M-Pesa help', 'How do I pay with M-Pesa?')
            ]
        }
    );
};

export const persistableMessages = (messages) => {
    return messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        suggestions: message.suggestions || [],
        timestamp: message.timestamp || Date.now()
    }));
};
