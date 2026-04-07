import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ShoppingCart, Star, Truck, Shield } from 'lucide-react';
import { getProductById } from '../lib/db';
import { useCart } from '../context/CartContext';
import './ProductDetails.css';

const FALLBACK_IMAGE = 'https://via.placeholder.com/800x600?text=No+Image';

const resolveImages = (product) => {
    if (Array.isArray(product.images) && product.images.length > 0) {
        return product.images;
    }

    if (product.image_url) {
        return [product.image_url];
    }

    if (product.image) {
        return [product.image];
    }

    return [FALLBACK_IMAGE];
};

const ProductDetails = () => {
    const { id } = useParams();
    const { addToCart } = useCart();
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeImage, setActiveImage] = useState(0);
    const [added, setAdded] = useState(false);

    useEffect(() => {
        let mounted = true;

        if (!id) return undefined;

        getProductById(id)
            .then((data) => {
                if (mounted) {
                    setProduct(data);
                    setActiveImage(0);
                }
            })
            .catch((err) => {
                console.error(err);
                if (mounted) {
                    setError('Product not found in Firestore.');
                }
            })
            .finally(() => {
                if (mounted) setLoading(false);
            });

        return () => {
            mounted = false;
        };
    }, [id]);

    const handleAddToCart = () => {
        if (!product || product.stock <= 0) return;
        addToCart(product, 1);
        setAdded(true);
        setTimeout(() => setAdded(false), 1200);
    };

    if (loading) return <div className="container" style={{ paddingTop: '5rem' }}>Loading details...</div>;
    if (!id) return <div className="container" style={{ paddingTop: '5rem' }}>Missing product ID.</div>;
    if (error) return <div className="container" style={{ paddingTop: '5rem' }}>{error}</div>;
    if (!product) return <div className="container" style={{ paddingTop: '5rem' }}>Product not found.</div>;

    const images = resolveImages(product);
    const rating = Number(product.reviews) || 4.8;

    return (
        <div className="product-page">
            <div className="container product-container">

                <div className="product-gallery">
                    <div className="main-image">
                        <img src={images[activeImage]} alt={product.name} />
                    </div>
                    <div className="thumbnail-list">
                        {images.map((img, idx) => (
                            <div
                                key={idx}
                                className={`thumbnail ${activeImage === idx ? 'active' : ''}`}
                                onClick={() => setActiveImage(idx)}
                            >
                                <img src={img} alt={`Thumbnail ${idx + 1}`} />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="product-info">
                    <div className="product-meta">
                        <span className="category-label">{product.category || 'General'}</span>
                        <div className="rating">
                            <Star size={16} fill="#fbbf24" color="#fbbf24" />
                            <span>{rating.toFixed(1)}</span>
                        </div>
                    </div>

                    <h1 className="product-title">{product.name}</h1>
                    <div className="product-price-large">KSh {product.price.toLocaleString()}</div>

                    <p className="product-desc">
                        {product.description || 'No detailed description is available for this item yet.'}
                    </p>

                    <div className="stock-info">
                        {product.stock > 0 ? (
                            <span className="in-stock">In Stock ({product.stock} units)</span>
                        ) : (
                            <span className="out-of-stock-text">Out of Stock</span>
                        )}
                    </div>

                    <div className="action-buttons">
                        <button
                            className="btn btn-primary add-to-cart-large"
                            onClick={handleAddToCart}
                            disabled={product.stock <= 0}
                        >
                            <ShoppingCart size={20} style={{ marginRight: '8px' }} />
                            {added ? 'Added' : 'Add to Cart'}
                        </button>
                    </div>

                    <div className="trust-signals">
                        <div className="trust-badge">
                            <Truck size={24} />
                            <span>Fast Nationwide Delivery</span>
                        </div>
                        <div className="trust-badge">
                            <Shield size={24} />
                            <span>Secure M-Pesa Payment</span>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ProductDetails;
