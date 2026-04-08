import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  BadgeCheck,
  Globe,
  Mail,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Truck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Footer.css';

const quickLinks = [
  { label: 'Home', to: '/' },
  { label: 'Categories', to: '/categories' },
  { label: 'Cart', to: '/cart' },
  { label: 'Checkout', to: '/checkout' }
];

const supportLinks = [
  { label: 'Track Orders', to: '/dashboard/orders' },
  { label: 'Manage Profile', to: '/dashboard/settings' },
  { label: 'Register Account', to: '/register' },
  { label: 'Sign In', to: '/login' }
];

const platformHighlights = [
  'Public product browsing without forcing login first',
  'Role-based accounts for institutions, parents, students, and admins',
  'Cloudinary-powered product images for cleaner media handling',
  'M-Pesa-ready checkout flow with tracked order history',
  'Mobile-first shopping experience built for fast repeat orders',
  'Admin-managed catalog, featured sections, stock, and order statuses'
];

const buyerSupport = [
  'Browse products, compare pricing, and add items to cart quickly',
  'Use dashboard pages to follow order totals, status, and recent activity',
  'Keep delivery, institution, and contact details up to date for checkout',
  'Use secure authentication with reset support and role-based access control'
];

const Footer = () => {
  const year = new Date().getFullYear();
  const { user, isAdmin } = useAuth();

  return (
    <footer className="site-footer">
      <div className="container footer-shell">
        <div className="footer-hero">
          <div className="footer-hero-copy footer-panel">
            <span className="footer-eyebrow">Zack</span>
            <h2>Institutional sourcing, cleaner order tracking, and mobile-first buying in one storefront.</h2>
            <p>
              Zack is designed to help institutions, parents, and procurement teams discover products,
              place orders with clarity, and stay informed from checkout to delivery. The platform is structured to
              keep products visible, payments straightforward, and post-purchase updates easy to follow.
            </p>

            <div className="footer-badges">
              <span><ShieldCheck size={16} /> Secure account flows</span>
              <span><ShoppingBag size={16} /> Order tracking dashboard</span>
              <span><Truck size={16} /> Delivery-ready checkout</span>
              <span><Smartphone size={16} /> Mobile-friendly experience</span>
            </div>
          </div>

          <div className="footer-hero-meta footer-panel">
            <div className="footer-meta-card">
              <h3>Store Confidence</h3>
              <p>
                Clear pricing, visible order stages, responsive account flows, and admin-managed storefront content
                help the platform feel reliable for both first-time and returning buyers.
              </p>
            </div>

            <div className="footer-meta-grid">
              <div>
                <span className="footer-meta-label">Support Email</span>
                <a href="mailto:komic102@gmail.com">komic102@gmail.com</a>
              </div>
              <div>
                <span className="footer-meta-label">Payments</span>
                <strong>M-Pesa Ready</strong>
              </div>
              <div>
                <span className="footer-meta-label">Media Handling</span>
                <strong>Cloudinary URLs</strong>
              </div>
              <div>
                <span className="footer-meta-label">Admin Control</span>
                <strong>Role Based</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="footer-grid">
          <section className="footer-section footer-panel">
            <span className="footer-section-title">Shop Navigation</span>
            <ul className="footer-links">
              {quickLinks.map((item) => (
                <li key={item.label}>
                  <Link to={item.to}>
                    <span>{item.label}</span>
                    <ArrowUpRight size={15} />
                  </Link>
                </li>
              ))}
            </ul>
            <p className="footer-note">
              Use these shortcuts to move quickly through the storefront from any page.
            </p>
          </section>

          <section className="footer-section footer-panel">
            <span className="footer-section-title">Accounts And Support</span>
            <ul className="footer-links">
              {supportLinks.map((item) => (
                <li key={item.label}>
                  <Link to={item.to}>
                    <span>{item.label}</span>
                    <ArrowUpRight size={15} />
                  </Link>
                </li>
              ))}
              {user && (
                <li>
                  <Link to="/dashboard">
                    <span>My Dashboard</span>
                    <ArrowUpRight size={15} />
                  </Link>
                </li>
              )}
              {isAdmin && (
                <li>
                  <Link to="/admin">
                    <span>Admin Console</span>
                    <ArrowUpRight size={15} />
                  </Link>
                </li>
              )}
            </ul>
            <p className="footer-note">
              Registration, profile management, order visibility, and admin access are all structured around role-based accounts.
            </p>
          </section>

          <section className="footer-section footer-panel">
            <span className="footer-section-title">Platform Highlights</span>
            <ul className="footer-checklist">
              {platformHighlights.map((item) => (
                <li key={item}>
                  <BadgeCheck size={16} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="footer-section footer-panel">
            <span className="footer-section-title">Buyer Guidance</span>
            <ul className="footer-checklist">
              {buyerSupport.map((item) => (
                <li key={item}>
                  <BadgeCheck size={16} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="footer-section footer-section-wide footer-panel developer-panel">
            <div className="developer-copy">
              <span className="footer-section-title">Developer Portfolio</span>
              <h3>jacmars tech.com</h3>
              <p>
                This platform is presented with a dedicated developer portfolio section so visitors, collaborators,
                and clients can clearly see who built the experience. It is a good place to highlight custom ecommerce
                builds, Firebase systems, Cloudinary media workflows, payment integrations, dashboards, and admin tooling.
              </p>
              <p>
                If you want the footer to work as both a trust signal and a business lead source, this section gives
                Jacmars Tech a visible home across the whole site.
              </p>
            </div>

            <div className="developer-links">
              <a href="https://jacmarstech.com" target="_blank" rel="noreferrer">
                <Globe size={16} />
                <span>Visit jacmars tech.com</span>
              </a>
              <a href="mailto:komic102@gmail.com">
                <Mail size={16} />
                <span>Email the developer</span>
              </a>
            </div>
          </section>
        </div>

        <div className="footer-bottom footer-panel">
          <p>
            Copyright {year} Zack. Built for clearer institutional procurement, smoother checkout, and better
            order visibility across desktop and mobile.
          </p>
          <p>
            Designed and developed with portfolio attribution for{' '}
            <a href="https://jacmarstech.com" target="_blank" rel="noreferrer">jacmars tech.com</a>.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
