import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Headphones, ShieldCheck, Sparkles, Truck } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import { getProducts } from '../lib/db';
import './Home.css';

const getProductImage = (product) => product?.image_url || product?.image || 'https://via.placeholder.com/720x720';

const Home = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState('All');
    const [search, setSearch] = useState('');
    const [error, setError] = useState(null);

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

    const filtered = useMemo(() => (
        products.filter((p) => {
            const matchesCategory = activeCategory === 'All' || p.category === activeCategory;
            const matchesSearch = (p.name || '').toLowerCase().includes(search.toLowerCase());
            return matchesCategory && matchesSearch;
        })
    ), [products, activeCategory, search]);

    const featuredProducts = useMemo(
        () => products.filter((p) => p.featured).slice(0, 4),
        [products]
    );

    const latestProducts = useMemo(
        () => products.slice(0, 8),
        [products]
    );

    const heroProducts = useMemo(
        () => (featuredProducts.length > 0 ? featuredProducts : latestProducts).slice(0, 3),
        [featuredProducts, latestProducts]
    );

    const featuredCollection = useMemo(
        () => (featuredProducts.length > 0 ? featuredProducts : latestProducts.slice(0, 4)),
        [featuredProducts, latestProducts]
    );

    const categoryHighlights = useMemo(
        () => categories.filter((category) => category !== 'All').slice(0, 6),
        [categories]
    );

    const storeSignals = [
        { icon: Truck, title: 'Fast Delivery', copy: 'Reliable dispatch for schools, offices, and institutions.' },
        { icon: ShieldCheck, title: 'Secure Payments', copy: 'Designed for confident checkout with clear order tracking.' },
        { icon: Headphones, title: 'Responsive Support', copy: 'Human support for sourcing, orders, and follow-up questions.' }
    ];

    return (
        <div className="home-page">
            <section className="hero">
                <div className="container hero-container">
                    <div className="hero-copy">
                        <div className="hero-eyebrow">
                            <Sparkles size={16} />
                            jack for modern institutions
                        </div>
                        <p className="hero-kicker">Premium</p>
                        <h1 className="hero-title">
                            <span>Institutional Supplies</span>
                            that feel organized, fast, and ready to scale.
                        </h1>
                        <p className="hero-description">
                            Build better classrooms, offices, and procurement workflows with curated products, clearer pricing, and dependable support from jack from discovery to delivery.
                        </p>
                        <div className="hero-actions">
                            <Link to="/categories" className="btn btn-primary hero-btn">
                                Shop Now
                                <ArrowRight size={18} />
                            </Link>
                            <Link to="/dashboard" className="btn btn-outline hero-secondary-btn">Track My Orders</Link>
                        </div>
                        <div className="hero-pills">
                            <span>Admin-curated featured products</span>
                            <span>Cloudinary image galleries</span>
                            <span>M-Pesa-ready checkout flow</span>
                        </div>
                    </div>

                    <div className="hero-visual">
                        <div className="hero-orb hero-orb-one"></div>
                        <div className="hero-orb hero-orb-two"></div>
                        {heroProducts.length > 0 ? (
                            <div className="hero-showcase">
                                <div className="hero-feature-card">
                                    <img
                                        src={getProductImage(heroProducts[0])}
                                        alt={heroProducts[0].name}
                                    />
                                    <div className="hero-feature-overlay">
                                        <span className="hero-feature-tag">{heroProducts[0].category || 'Featured pick'}</span>
                                        <h3>{heroProducts[0].name}</h3>
                                        <p>KSh {Number(heroProducts[0].price || 0).toLocaleString()}</p>
                                    </div>
                                </div>

                                <div className="hero-side-stack">
                                    {heroProducts.slice(1).map((product) => (
                                        <div key={product.id} className="hero-mini-card">
                                            <img src={getProductImage(product)} alt={product.name} />
                                            <div>
                                                <span>{product.category || 'Catalog item'}</span>
                                                <strong>{product.name}</strong>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="hero-note-card">
                                        Products marked as <strong>Featured</strong> in Admin show up here automatically.
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="hero-empty-visual">
                                <div className="hero-empty-card">
                                    <span>Curated Catalog</span>
                                    <strong>Ready for your first product drop</strong>
                                    <p>Add products in Admin, then toggle featured items to shape the storefront.</p>
                                </div>
                                <div className="hero-empty-metrics">
                                    <div>
                                        <strong>Mobile-first</strong>
                                        <span>Fast purchasing on phones and tablets</span>
                                    </div>
                                    <div>
                                        <strong>Secure flow</strong>
                                        <span>Structured checkout and order status tracking</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <section className="trust-strip">
                <div className="container trust-grid">
                    {storeSignals.map((item) => {
                        const Icon = item.icon;

                        return (
                            <article key={item.title} className="trust-card">
                                <div className="trust-icon">
                                    <Icon size={20} />
                                </div>
                                <div>
                                    <h3>{item.title}</h3>
                                    <p>{item.copy}</p>
                                </div>
                            </article>
                        );
                    })}
                </div>
            </section>

            <section className="category-section">
                <div className="container">
                    <div className="section-header section-header-stack">
                        <div>
                            <p className="section-kicker">Browse Faster</p>
                            <h2>Shop by category, not by endless scrolling</h2>
                            <p className="section-copy">Use these quick category paths to move straight into the part of the catalog that matters.</p>
                        </div>
                    </div>
                    <div className="category-grid">
                        {categoryHighlights.length > 0 ? categoryHighlights.map((category) => (
                            <Link
                                key={category}
                                to={`/categories?category=${encodeURIComponent(category)}`}
                                className="category-card"
                            >
                                <span>{category}</span>
                                <ArrowRight size={18} />
                            </Link>
                        )) : (
                            <div className="empty-state">
                                <p>Categories will appear here once products are added in the admin dashboard.</p>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <section className="featured-products">
                <div className="container">
                    <div className="section-header section-header-stack">
                        <div>
                            <p className="section-kicker">Admin Curated</p>
                            <h2>Featured products that deserve the spotlight</h2>
                            <p className="section-copy">
                                {featuredProducts.length > 0
                                    ? 'This section is controlled from Admin by toggling the featured option on a product.'
                                    : 'No featured products are selected yet, so the newest items are filling the section for now.'}
                            </p>
                        </div>
                        <Link to="/categories" className="view-all">View catalog</Link>
                    </div>
                    <div className="product-grid">
                        {loading ? (
                            [1, 2, 3, 4].map((n) => <div key={n} className="skeleton-card"></div>)
                        ) : featuredCollection.length > 0 ? (
                            featuredCollection.map((product) => <ProductCard key={product.id} product={product} />)
                        ) : (
                            <div className="empty-state">
                                <p>No featured products yet. Toggle "featured" in Admin to highlight top items.</p>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <section className="latest-products">
                <div className="container">
                    <div className="section-header section-header-stack">
                        <div>
                            <p className="section-kicker">Fresh In</p>
                            <h2>New arrivals for schools, offices, and bulk buyers</h2>
                            <p className="section-copy">The newest additions to your catalog appear here first, with the same quick path into product details.</p>
                        </div>
                    </div>
                    <div className="product-grid">
                        {loading ? (
                            [1, 2, 3, 4].map((n) => <div key={n} className="skeleton-card"></div>)
                        ) : latestProducts.length > 0 ? (
                            latestProducts.map((product) => <ProductCard key={product.id} product={product} />)
                        ) : (
                            <div className="empty-state">
                                <p>No products available yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <section className="catalog-products">
                <div className="container">
                    <div className="section-header">
                        <div>
                            <p className="section-kicker">Explore</p>
                            <h2>Search, filter, and compare your catalog</h2>
                        </div>
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Search by product name..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="category-filter">
                        {categories.map((cat) => (
                            <button
                                key={cat}
                                className={`filter-btn ${activeCategory === cat ? 'active' : ''}`}
                                onClick={() => setActiveCategory(cat)}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    {error && <div className="error-banner">{error}</div>}

                    <div className="product-grid">
                        {loading ? (
                            [1, 2, 3, 4].map((n) => <div key={n} className="skeleton-card"></div>)
                        ) : filtered.length === 0 ? (
                            <div className="empty-state">
                                <p>No products found. Try a different search or category.</p>
                            </div>
                        ) : (
                            filtered.map((product) => <ProductCard key={product.id} product={product} />)
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Home;
