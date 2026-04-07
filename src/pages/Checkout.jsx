import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { createOrder } from '../lib/db';
import { checkMpesaPaymentStatus, hasPaymentsBackend, requestMpesaStkPush, sleep } from '../lib/payments';
import './Checkout.css';

const POLL_ATTEMPTS = 8;
const POLL_INTERVAL_MS = 3000;

const normalizeStatus = (value) => String(value || '').toLowerCase();

const isPaidResponse = (response = {}) => {
    const status = normalizeStatus(response.status || response.paymentStatus || response.resultDesc);
    const resultCode = String(response.resultCode ?? response.ResultCode ?? '');
    return response.paid === true || resultCode === '0' || ['paid', 'success', 'completed', 'complete'].includes(status);
};

const isFailedResponse = (response = {}) => {
    const status = normalizeStatus(response.status || response.paymentStatus || response.resultDesc);
    const resultCode = String(response.resultCode ?? response.ResultCode ?? '');

    if (resultCode && resultCode !== '0') return true;
    return ['failed', 'cancelled', 'rejected', 'declined', 'error'].includes(status);
};

const Checkout = () => {
    const { user } = useAuth();
    const { cart, cartTotal, clearCart } = useCart();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        address: '',
        city: ''
    });
    const [step, setStep] = useState(1); // 1: Delivery, 2: Payment, 3: Success
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [paymentMessage, setPaymentMessage] = useState('');
    const [finalStatus, setFinalStatus] = useState('paid');

    if (!user) {
        return <Navigate to="/login" />;
    }

    const deliveryFee = 500;
    const totalAmount = cartTotal + deliveryFee;

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleProceedToPayment = (e) => {
        e.preventDefault();
        setError('');
        setPaymentMessage('');
        setStep(2);
    };

    const buildOrderPayload = (status, payment = {}) => ({
        user_id: user.uid,
        customer: {
            ...formData,
            email: formData.email || user.email || ''
        },
        items: cart.map((item) => ({
            product_id: item.id,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            image_url: item.image_url || item.image || ''
        })),
        subtotal: cartTotal,
        delivery_fee: deliveryFee,
        total: totalAmount,
        status,
        payment: {
            method: 'mpesa',
            ...payment
        }
    });

    const handleMpesaPayment = async () => {
        if (cart.length === 0) return;

        setLoading(true);
        setError('');
        setPaymentMessage('');

        try {
            if (!hasPaymentsBackend) {
                setPaymentMessage('Simulation mode active. Configure VITE_PAYMENTS_API_BASE_URL for live STK push.');
                await sleep(2000);
                await createOrder(buildOrderPayload('paid', { mode: 'simulation', paid: true }));
                setFinalStatus('paid');
                clearCart();
                setStep(3);
                return;
            }

            const initResponse = await requestMpesaStkPush({
                phoneNumber: formData.phone,
                amount: totalAmount,
                accountReference: `ORD-${Date.now()}`,
                transactionDesc: 'Institutional supplies order'
            });

            const checkoutRequestId =
                initResponse.checkoutRequestId ||
                initResponse.CheckoutRequestID ||
                initResponse.data?.checkoutRequestId ||
                initResponse.data?.CheckoutRequestID;

            if (!checkoutRequestId) {
                throw new Error('M-Pesa provider did not return a checkout request ID.');
            }

            setPaymentMessage('STK push sent. Complete payment on your phone to continue.');

            let latestResponse = initResponse;
            for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
                await sleep(POLL_INTERVAL_MS);
                latestResponse = await checkMpesaPaymentStatus(checkoutRequestId);

                if (isPaidResponse(latestResponse)) {
                    await createOrder(buildOrderPayload('paid', {
                        checkoutRequestId,
                        paid: true,
                        response: latestResponse
                    }));
                    setFinalStatus('paid');
                    setPaymentMessage('Payment confirmed. Order has been created.');
                    clearCart();
                    setStep(3);
                    return;
                }

                if (isFailedResponse(latestResponse)) {
                    throw new Error(latestResponse.message || 'Payment failed or cancelled.');
                }
            }

            await createOrder(buildOrderPayload('pending', {
                checkoutRequestId,
                paid: false,
                response: latestResponse
            }));
            setFinalStatus('pending');
            setPaymentMessage('Order saved. Payment is still pending confirmation.');
            clearCart();
            setStep(3);
        } catch (err) {
            console.error(err);
            setError(`Payment failed: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    if (cart.length === 0 && step !== 3) {
        return (
            <div className="container" style={{ paddingTop: '6rem', textAlign: 'center' }}>
                <h2>No items to checkout</h2>
                <button className="btn btn-primary mt-4" onClick={() => navigate('/')}>Return Home</button>
            </div>
        );
    }

    return (
        <div className="checkout-page container">
            <div className="checkout-tabs">
                <div className={`tab ${step >= 1 ? 'active' : ''}`}>1. Delivery</div>
                <div className={`tab ${step >= 2 ? 'active' : ''}`}>2. Payment</div>
                <div className={`tab ${step === 3 ? 'active' : ''}`}>3. Confirmation</div>
            </div>

            {error && <div className="error-alert">{error}</div>}

            {step === 1 && (
                <div className="checkout-layout">
                    <form className="checkout-form" onSubmit={handleProceedToPayment}>
                        <h2>Delivery Details</h2>
                        <div className="form-group row">
                            <input required name="name" placeholder="Full Name" value={formData.name} onChange={handleInputChange} />
                            <input required type="email" name="email" placeholder="Email Address" value={formData.email} onChange={handleInputChange} />
                        </div>
                        <div className="form-group">
                            <input required type="tel" name="phone" placeholder="M-Pesa Phone Number (e.g. 07...)" value={formData.phone} onChange={handleInputChange} />
                        </div>
                        <div className="form-group">
                            <input required name="address" placeholder="Street Address" value={formData.address} onChange={handleInputChange} />
                        </div>
                        <div className="form-group">
                            <input required name="city" placeholder="City" value={formData.city} onChange={handleInputChange} />
                        </div>

                        <button type="submit" className="btn btn-primary w-100">Continue to Payment</button>
                    </form>

                    <div className="checkout-summary">
                        <h3>Order Summary</h3>
                        <div className="summary-items">
                            {cart.map((item) => (
                                <div key={item.id} className="summary-item">
                                    <span>{item.quantity}x {item.name}</span>
                                    <span>KSh {(item.price * item.quantity).toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                        <div className="summary-divider"></div>
                        <div className="summary-row">
                            <span>Subtotal</span>
                            <span>KSh {cartTotal.toLocaleString()}</span>
                        </div>
                        <div className="summary-row">
                            <span>Delivery Fee</span>
                            <span>KSh {deliveryFee.toLocaleString()}</span>
                        </div>
                        <div className="summary-divider"></div>
                        <div className="summary-row total">
                            <span>Total to Pay</span>
                            <span>KSh {totalAmount.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            )}

            {step === 2 && (
                <div className="payment-section">
                    <div className="payment-card">
                        <div className="payment-header">
                            <img src="https://upload.wikimedia.org/wikipedia/commons/1/15/M-PESA_LOGO-01.svg" alt="M-Pesa" height="40" />
                            <h2>M-Pesa Payment Validation</h2>
                        </div>

                        <div className="payment-body">
                            <p>You are about to pay <strong>KSh {totalAmount.toLocaleString()}</strong></p>
                            <p>Phone Number: <strong>{formData.phone}</strong></p>
                            <p className="mode-note">
                                {hasPaymentsBackend
                                    ? 'Live M-Pesa mode enabled.'
                                    : 'Simulation mode enabled. Set VITE_PAYMENTS_API_BASE_URL for live STK push.'}
                            </p>

                            <div className="instructions">
                                <p>1. Click "Trigger M-Pesa Prompt" below.</p>
                                <p>2. Check your phone for the M-Pesa PIN prompt.</p>
                                <p>3. Enter your PIN to complete the transaction.</p>
                            </div>

                            {paymentMessage && <p className="payment-note">{paymentMessage}</p>}

                            {loading ? (
                                <div className="loading-state">
                                    <Loader2 className="spinner" size={40} />
                                    <p>Awaiting payment confirmation from your phone...</p>
                                </div>
                            ) : (
                                <button className="btn btn-success trigger-btn" onClick={handleMpesaPayment}>
                                    Trigger M-Pesa Prompt
                                </button>
                            )}
                        </div>
                        <div className="payment-footer">
                            <ShieldCheck size={16} /> Secured by Safaricom Daraja API
                        </div>
                    </div>
                </div>
            )}

            {step === 3 && (
                <div className="success-section">
                    <div className="success-icon">{finalStatus === 'paid' ? 'OK' : '...'}</div>
                    <h2>{finalStatus === 'paid' ? 'Payment Successful!' : 'Order Received (Payment Pending)'}</h2>
                    <p>
                        {finalStatus === 'paid'
                            ? 'Your order has been saved and is now processing.'
                            : 'Your order has been saved, and we are waiting for payment confirmation.'}
                    </p>
                    {paymentMessage && <p className="payment-note">{paymentMessage}</p>}
                    <div className="success-actions">
                        <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>View Order Status</button>
                        <button className="btn" style={{ backgroundColor: '#e2e8f0', color: '#1e293b' }} onClick={() => navigate('/')}>Continue Shopping</button>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Checkout;
