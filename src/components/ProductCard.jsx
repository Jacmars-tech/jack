import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, ShoppingCart } from 'lucide-react';
import { useCart } from '../context/CartContext';
import './ProductCard.css';

const ProductCard = ({ product }) => {
    const navigate = useNavigate();
    const { addToCart } = useCart();
    const productImage = product.image_url || product.image || 'https://via.placeholder.com/300x300';
    const productDescription = product.description || 'Reliable institutional supplies selected for everyday performance.';

    const handleViewProduct = () => {
        navigate(`/product/${product.id}`);
    };

    const handleKeyDown = (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleViewProduct();
        }
    };

    const handleAddToCart = (event) => {
        event.stopPropagation();
        addToCart(product);
    };

    return (
        <article
            className="product-card"
            role="link"
            tabIndex={0}
            onClick={handleViewProduct}
            onKeyDown={handleKeyDown}
            aria-label={`View details for ${product.name}`}
        >
            <div className="product-image-container">
                <img src={productImage} alt={product.name} className="product-image" />
                <div className="product-badges">
                    {product.featured && <span className="badge featured">Featured</span>}
                    {product.stock <= 0 && <span className="badge out-of-stock">Sold Out</span>}
                </div>
            </div>
            <div className="product-details">
                <span className="product-category">{product.category}</span>
                <h3 className="product-name">{product.name}</h3>
                <p className="product-description">{productDescription}</p>
                <div className="product-meta">
                    <span>{product.stock > 0 ? `${product.stock} in stock` : 'Restocking soon'}</span>
                    <span className="product-link-hint">View details <ArrowUpRight size={15} /></span>
                </div>
                <div className="product-bottom">
                    <span className="product-price">KSh {product.price.toLocaleString()}</span>
                    <button
                        className="btn btn-primary add-cart-btn"
                        onClick={handleAddToCart}
                        disabled={product.stock <= 0}
                        aria-label={`Add ${product.name} to cart`}
                    >
                        <ShoppingCart size={18} />
                        <span>{product.stock <= 0 ? 'Unavailable' : 'Add to Cart'}</span>
                    </button>
                </div>
            </div>
        </article>
    );
};

export default ProductCard;
