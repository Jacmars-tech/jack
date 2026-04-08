import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, LayoutGrid, Box, Shirt, Pen, FlaskConical } from 'lucide-react';
import { getProducts } from '../lib/db';
import './Home.css';

const getProductImage = (product) => product?.image_url || product?.image || 'https://via.placeholder.com/720x720';

const Home = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getProducts()
            .then((data) => setProducts(data))
            .catch((err) => {
                console.error(err);
                setError('Could not load products. Make sure your Firebase config is set up in .env.local');
            })
            .finally(() => setLoading(false));
    }, []);

    const categories = useMemo(
        () => ['All', ...new Set(products.map((p) => p.category).filter(Boolean))],
        [products]
    );

    return (
        <div className="home-page">
            <section className="hero">
                <div className="container hero-container">
                    <div className="hero-panel">
                        <h1>Welcome to ZACK</h1>
                        <p>Select a category to explore our institutional supplies.</p>
                        <div className="hero-actions">
                            <Link to="/categories" className="btn btn-primary hero-btn">
                                Shop Now <ArrowRight size={16} />
                            </Link>
                            <Link to="/dashboard" className="btn hero-secondary-btn">Track Orders</Link>
                        </div>
                    </div>
                </div>
            </section>

            <section className="category-section">
                <div className="container">
                    <h2 className="section-title">Categories</h2>
                    <div className="category-card-row">
                        <Link to="/categories" className="cat-button">
                            <LayoutGrid size={24} />
                            <span>All Items</span>
                        </Link>
                        <Link to="/categories?category=Kits" className="cat-button">
                            <Box size={24} />
                            <span>Student Kits</span>
                        </Link>
                        <Link to="/categories?category=Uniforms" className="cat-button">
                            <Shirt size={24} />
                            <span>Uniforms</span>
                        </Link>
                        <Link to="/categories?category=Stationery" className="cat-button">
                            <Pen size={24} />
                            <span>Stationery</span>
                        </Link>
                        <Link to="/categories?category=Lab" className="cat-button">
                            <FlaskConical size={24} />
                            <span>Lab Gear</span>
                        </Link>
                    </div>
                </div>
            </section>

            <section className="how-it-works">
                <div className="container">
                    <h2 className="section-title">How It Works</h2>
                    <div className="how-grid">
                        <div className="how-card">
                            <div className="step-badge">1</div>
                            <h3>Select School</h3>
                            <p>Choose your institution to see specific requirements.</p>
                        </div>
                        <div className="how-card">
                            <div className="step-badge">2</div>
                            <h3>Pick a Kit</h3>
                            <p>Bundle essentials and save more across categories.</p>
                        </div>
                        <div className="how-card">
                            <div className="step-badge">3</div>
                            <h3>Fast Delivery</h3>
                            <p>Track orders end-to-end from dashboard on any device.</p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Home;
