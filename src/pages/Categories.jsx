import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { Search, Filter, Menu } from 'lucide-react';
import { getProducts } from '../lib/db';
import './Categories.css';

const Categories = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [minPrice, setMinPrice] = useState('');
    const [maxPrice, setMaxPrice] = useState('');
    const [selectedInstitution, setSelectedInstitution] = useState('All');
    const [showFilters, setShowFilters] = useState(false);
    const [error, setError] = useState('');

    const searchTerm = searchParams.get('search') || '';
    const selectedCategory = searchParams.get('category') || 'All';
    const institutionTypes = [
        'All',
        'Institutions',
        'Pre School',
        'Junior School',
        'High School',
        'Polytechnic',
        'College',
        'Campus'
    ];

    useEffect(() => {
        let mounted = true;

        getProducts()
            .then((data) => {
                if (mounted) setProducts(data);
            })
            .catch((err) => {
                console.error(err);
                if (mounted) {
                    setError('Could not load products from Firebase. Check your config and Firestore rules.');
                }
            })
            .finally(() => {
                if (mounted) setLoading(false);
            });

        return () => {
            mounted = false;
        };
    }, []);

    const updateSearchParams = (nextValues) => {
        const nextParams = new URLSearchParams(searchParams);

        Object.entries(nextValues).forEach(([key, value]) => {
            if (!value || value === 'All') {
                nextParams.delete(key);
                return;
            }

            nextParams.set(key, value);
        });

        setSearchParams(nextParams);
    };

    const categories = ['All', ...new Set(products.map((p) => p.category).filter(Boolean))];

    const filteredProducts = useMemo(() => {
        const minValue = minPrice === '' ? null : Number(minPrice);
        const maxValue = maxPrice === '' ? null : Number(maxPrice);

        const normalizedInstitution = (value = '') => value.toLowerCase().trim();
        const targetInstitution = normalizedInstitution(selectedInstitution);

        return products.filter(product => {
            const priceValue = Number(product.price) || 0;
            const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
            const matchesMin = minValue === null || priceValue >= minValue;
            const matchesMax = maxValue === null || priceValue <= maxValue;

            const productInstitution = normalizedInstitution(product.institutionType || product.category || '');
            const matchesInstitution =
                selectedInstitution === 'All' ||
                productInstitution === targetInstitution ||
                productInstitution.includes(targetInstitution);

            return matchesSearch && matchesCategory && matchesMin && matchesMax && matchesInstitution;
        });
    }, [products, searchTerm, selectedCategory, minPrice, maxPrice, selectedInstitution]);

    return (
        <div className="categories-page container">
            <div className="page-header">
                <h1>Browse Products</h1>
                <p>Find the best supplies for your institution.</p>
            </div>

            <div className="catalog-layout">
                <div className="filters-layout">
                    <aside className={`filters-panel ${showFilters ? 'open' : ''}`}>
                        <div className="filters-header">
                            <div className="filters-title">
                                <Filter size={18} />
                                <span>Filters</span>
                            </div>
                            <button className="filters-close" onClick={() => setShowFilters(false)}>Close</button>
                        </div>

                        <div className="filters-section">
                            <div className="search-bar">
                                <Search size={20} className="search-icon" />
                                <input
                                    type="text"
                                    placeholder="Search by product name..."
                                    value={searchTerm}
                                    onChange={(e) => updateSearchParams({ search: e.target.value, category: selectedCategory })}
                                />
                            </div>

                            <div className="price-filters">
                                <input
                                    type="number"
                                    placeholder="Min Price"
                                    value={minPrice}
                                    onChange={(e) => setMinPrice(e.target.value)}
                                />
                                <input
                                    type="number"
                                    placeholder="Max Price"
                                    value={maxPrice}
                                    onChange={(e) => setMaxPrice(e.target.value)}
                                />
                            </div>

                            <div className="category-filters">
                                <div className="filter-label">
                                    <Filter size={18} className="filter-icon" />
                                    <span>Categories</span>
                                </div>
                                <div className="chip-grid">
                                    {categories.map(cat => (
                                        <button
                                            key={cat}
                                            className={`chip-btn ${selectedCategory === cat ? 'active' : ''}`}
                                            onClick={() => updateSearchParams({ search: searchTerm, category: cat })}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="institution-filters">
                                <div className="filter-label">
                                    <Filter size={18} className="filter-icon" />
                                    <span>Institution Type</span>
                                </div>
                                <div className="chip-grid">
                                    {institutionTypes.map((type) => (
                                        <button
                                            key={type}
                                            className={`chip-btn ${selectedInstitution === type ? 'active' : ''}`}
                                            onClick={() => setSelectedInstitution(type)}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </aside>

                    <div className="filters-overlay" onClick={() => setShowFilters(false)}></div>

                    <div className="filters-toggle-row">
                        <button className="filters-toggle" onClick={() => setShowFilters(true)}>
                            <Menu size={18} />
                            <span>Filters</span>
                        </button>
                    </div>
                </div>

                <div className="product-grid">
                    {loading ? (
                        [1, 2, 3, 4, 5, 6].map(n => <div key={n} className="skeleton-card"></div>)
                    ) : error ? (
                        <div className="no-results">
                            <h3>Unable to load products</h3>
                            <p>{error}</p>
                        </div>
                    ) : filteredProducts.length > 0 ? (
                        filteredProducts.map(product => (
                            <ProductCard key={product.id} product={product} />
                        ))
                    ) : (
                        <div className="no-results">
                            <h3>No products found</h3>
                            <p>
                                {products.length === 0
                                    ? 'No products are in Firestore yet. Add some from the Admin page.'
                                    : 'Try adjusting your search, category, or price filters.'}
                            </p>
                            <button
                                className="btn btn-primary mt-4"
                                onClick={() => {
                                    updateSearchParams({ search: '', category: 'All' });
                                    setMinPrice('');
                                    setMaxPrice('');
                                }}
                            >
                                Clear Filters
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Categories;
