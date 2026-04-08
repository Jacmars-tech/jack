import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { ShoppingCart, User, Search, LogOut, ShieldCheck, Bot, Bell, Menu, X } from 'lucide-react';
import './Navbar.css';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin, signOut } = useAuth();
  const { cartCount } = useCart();
  const previousCartCount = useRef(cartCount);
  const cartLinkRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState('');
  const showSearch = location.pathname !== '/';
  const notifyHref = user ? '/dashboard/orders' : '/login';
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const cartNode = cartLinkRef.current;

    if (cartNode && cartCount > previousCartCount.current) {
      cartNode.classList.remove('is-bouncing');
      void cartNode.offsetWidth;
      cartNode.classList.add('is-bouncing');

      const timeoutId = window.setTimeout(() => {
        cartNode.classList.remove('is-bouncing');
      }, 550);

      previousCartCount.current = cartCount;
      return () => window.clearTimeout(timeoutId);
    }

    previousCartCount.current = cartCount;
    return undefined;
  }, [cartCount]);

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const query = searchTerm.trim();
    navigate(query ? `/categories?search=${encodeURIComponent(query)}` : '/categories');
  };

  const handleOpenAssistant = () => {
    window.dispatchEvent(new Event('open-chat'));
  };

  const toggleDrawer = () => setDrawerOpen((prev) => !prev);
  const closeDrawer = () => setDrawerOpen(false);

  return (
    <header className="navbar">
      <div className="container nav-container">
        <button className="nav-menu-btn" onClick={toggleDrawer} aria-label="Toggle menu">
          {drawerOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <Link to="/" className="nav-logo">
          <span className="nav-logo-main">Zack</span>
        </Link>

        {showSearch && (
          <form className="nav-search" onSubmit={handleSearchSubmit}>
            <input
              type="text"
              placeholder="Search products, kits, categories..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            <button type="submit" className="search-btn" aria-label="Search products">
              <Search size={18} />
            </button>
          </form>
        )}

        <nav className="nav-links">
          <Link to="/" className="nav-link hide-mobile">Home</Link>
          <Link to="/categories" className="nav-link hide-mobile">Categories</Link>
          <Link ref={cartLinkRef} to="/cart" className="nav-link icon-link nav-cart-link">
            <ShoppingCart size={24} />
            <span className="cart-badge">{cartCount > 99 ? '99+' : cartCount}</span>
          </Link>
          <Link to={notifyHref} className="nav-link icon-link nav-notify-link" title="Notifications">
            <Bell size={20} />
            <span className="notify-dot" />
          </Link>
          <button type="button" className="nav-link icon-link nav-ai-link" onClick={handleOpenAssistant} title="Open AI assistant">
            <Bot size={20} />
            <span className="hide-mobile">AI</span>
          </button>

          {user ? (
            <div className="nav-user">
              {isAdmin && (
                <Link to="/admin" className="nav-link nav-admin-link">
                  <ShieldCheck size={16} />
                  <span>Admin</span>
                </Link>
              )}
              <Link to="/dashboard" className="nav-link icon-link">
                <User size={22} />
              </Link>
              <button onClick={signOut} className="nav-link logout-btn" title="Sign Out">
                <LogOut size={22} />
              </button>
            </div>
          ) : (
            <Link to="/login" className="nav-link icon-link">
              <User size={22} />
            </Link>
          )}
        </nav>
      </div>

      <div className={`drawer-overlay ${drawerOpen ? 'open' : ''}`} onClick={closeDrawer} />
      <aside className={`mobile-drawer ${drawerOpen ? 'open' : ''}`}>
        <nav>
          <Link to="/" onClick={closeDrawer}>Home</Link>
          <Link to="/categories" onClick={closeDrawer}>Categories</Link>
          <Link to="/cart" onClick={closeDrawer}>Cart</Link>
          <Link to="/dashboard" onClick={closeDrawer}>Dashboard</Link>
          {isAdmin && <Link to="/admin" onClick={closeDrawer}>Admin</Link>}
          {!user && <Link to="/login" onClick={closeDrawer}>Login</Link>}
        </nav>
      </aside>
    </header>
  );
};

export default Navbar;
