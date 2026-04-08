const DEFAULT_ENDPOINT = import.meta.env.VITE_AI_ASSISTANT_API_URL
    || (import.meta.env.DEV ? '/api/assistant' : '');

const hasEndpoint = Boolean(DEFAULT_ENDPOINT);

const toPrice = (value) => Number(value || 0);

const mapProducts = (products) => {
    return products.slice(0, 80).map((product) => ({
        id: product.id,
        name: product.name,
        category: product.category || 'General',
        price: toPrice(product.price),
        stock: Number(product.stock) || 0,
        featured: Boolean(product.featured),
        description: String(product.description || '').slice(0, 240)
    }));
};

const mapOrders = (orders) => {
    return orders.slice(0, 10).map((order) => ({
        id: order.id,
        status: order.status || 'pending',
        total: toPrice(order.total),
        city: order.customer?.city || '',
        itemCount: Array.isArray(order.items) ? order.items.length : 0,
        createdAt: order.created_at instanceof Date ? order.created_at.toISOString() : ''
    }));
};

const mapCart = (cart) => {
    return cart.slice(0, 20).map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category || 'General',
        price: toPrice(item.price),
        quantity: Number(item.quantity) || 0
    }));
};

export const requestAssistantReply = async ({
    message,
    previousResponseId,
    products,
    orders,
    cart,
    user,
    profile,
    currentPath
}) => {
    if (!hasEndpoint) {
        throw new Error('Assistant endpoint is not configured for production.');
    }

    const response = await fetch(DEFAULT_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message,
            previousResponseId,
            context: {
                currentPath,
                user: user ? {
                    uid: user.uid,
                    email: user.email || '',
                    displayName: user.displayName || profile?.displayName || ''
                } : null,
                profile: profile ? {
                    accountType: profile.accountType || '',
                    role: profile.role || '',
                    accessRole: profile.accessRole || 'customer',
                    displayName: profile.displayName || '',
                    institutionName: profile.institutionName || '',
                    county: profile.county || ''
                } : null,
                products: mapProducts(products),
                orders: mapOrders(orders),
                cart: mapCart(cart)
            }
        })
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(payload.error || 'The Zack AI service is unavailable right now.');
    }

    return {
        reply: payload.reply || '',
        responseId: payload.responseId || '',
        model: payload.model || ''
    };
};
