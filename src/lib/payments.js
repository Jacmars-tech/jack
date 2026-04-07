const rawBase = (import.meta.env.VITE_PAYMENTS_API_BASE_URL || '').trim();
const normalizedBase = rawBase.replace(/\/$/, '');
const looksValid = normalizedBase.startsWith('http');
const isPlaceholder = normalizedBase.includes('your-payments-api');

const PAYMENTS_API_BASE_URL = looksValid && !isPlaceholder ? normalizedBase : '';

export const hasPaymentsBackend = Boolean(PAYMENTS_API_BASE_URL);

const parseJsonSafely = async (response) => {
    try {
        return await response.json();
    } catch {
        return {};
    }
};

export async function requestMpesaStkPush(payload) {
    if (!hasPaymentsBackend) {
        return { simulated: true, status: 'simulated' };
    }

    const response = await fetch(`${PAYMENTS_API_BASE_URL}/payments/mpesa/stk-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await parseJsonSafely(response);
    if (!response.ok) {
        throw new Error(data.message || 'Failed to initiate M-Pesa payment.');
    }

    return data;
}

export async function checkMpesaPaymentStatus(checkoutRequestId) {
    if (!hasPaymentsBackend) {
        return { simulated: true, status: 'paid', paid: true };
    }

    const encodedId = encodeURIComponent(checkoutRequestId);
    const response = await fetch(`${PAYMENTS_API_BASE_URL}/payments/mpesa/status/${encodedId}`);
    const data = await parseJsonSafely(response);

    if (!response.ok) {
        throw new Error(data.message || 'Failed to verify M-Pesa payment status.');
    }

    return data;
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
