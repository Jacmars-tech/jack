import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { Trash2, Plus, Minus, ArrowRight } from 'lucide-react';
import './Cart.css';

const Cart = () => {
    const { cart, updateQuantity, removeFromCart, cartTotal } = useCart();
    const navigate = useNavigate();

    if (cart.length === 0) {
        return (
            <div className="container empty-cart-page">
                <h2>Your Cart is Empty</h2>
                <p>Looks like you haven't added anything to your cart yet.</p>
                <Link to="/categories" className="btn btn-primary mt-4">Start Shopping</Link>
            </div>
        );
    }

    return (
        <div className="cart-page container">
            <h1>Shopping Cart</h1>

            <div className="cart-layout">
                <div className="cart-items">
                    {cart.map(item => (
                        <div key={item.id} className="cart-item">
                            <div className="item-image">
                                <img src={item.image_url || item.image || 'https://via.placeholder.com/300x300'} alt={item.name} />
                            </div>
                            <div className="item-details">
                                <h3><Link to={`/product/${item.id}`}>{item.name}</Link></h3>
                                <span className="item-category">{item.category}</span>
                                <div className="item-price">KSh {item.price.toLocaleString()}</div>
                            </div>

                            <div className="item-controls">
                                <div className="quantity-controls">
                                    <button onClick={() => updateQuantity(item.id, item.quantity - 1)}>
                                        <Minus size={16} />
                                    </button>
                                    <span>{item.quantity}</span>
                                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)} disabled={item.quantity >= item.stock}>
                                        <Plus size={16} />
                                    </button>
                                </div>
                                <button className="remove-btn" onClick={() => removeFromCart(item.id)}>
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="cart-summary">
                    <h2>Order Summary</h2>
                    <div className="summary-row">
                        <span>Subtotal</span>
                        <span>KSh {cartTotal.toLocaleString()}</span>
                    </div>
                    <div className="summary-row">
                        <span>Delivery</span>
                        <span>Calculated at checkout</span>
                    </div>
                    <div className="summary-divider"></div>
                    <div className="summary-row total">
                        <span>Total</span>
                        <span>KSh {cartTotal.toLocaleString()}</span>
                    </div>

                    <button
                        className="btn btn-primary checkout-btn"
                        onClick={() => navigate('/checkout')}
                    >
                        Proceed to Checkout <ArrowRight size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Cart;
