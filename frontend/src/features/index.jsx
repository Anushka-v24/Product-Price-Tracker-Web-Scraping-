/**
 * THE LIST OF PAGES (same idea as backend/src/modules/index.js).
 *
 * Each feature folder exports its page component. To remove a page, delete its entry here.
 *   path  - URL of the page
 *   nav   - label in the sidebar (omit to hide it from the menu)
 *   icon  - sidebar icon name (see components/Icons.jsx)
 */
import DashboardPage from './dashboard/DashboardPage.jsx';
import SearchPage from './search/SearchPage.jsx';
import ProductPage from './product/ProductPage.jsx';
import CheckLogPage from './checks/CheckLogPage.jsx';
import AlertsPage from './alerts/AlertsPage.jsx'; // optional feature

export const pages = [
  { path: '/', element: <DashboardPage />, nav: 'Dashboard', icon: 'dashboard' },
  { path: '/search', element: <SearchPage />, nav: 'Track a product', icon: 'search' },
  { path: '/products/:id', element: <ProductPage /> },
  { path: '/checks', element: <CheckLogPage />, nav: 'Check log', icon: 'log' },
  { path: '/alerts', element: <AlertsPage />, nav: 'Alerts', icon: 'bell', badge: 'alerts' },
];
