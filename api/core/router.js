/**
 * @file api/core/router.js
 * @description Minimal router with :param support, middleware chains, and
 * scope-gated API-key authorization.
 *
 * Registration: router.get('/path', requireScope('read'), handler)
 * - Any number of middlewares may precede the final handler.
 * - A middleware either throws (ApiError → handled centrally) or returns
 *   normally to continue the chain. If it already wrote a response, the
 *   chain stops.
 */

const { authenticate } = require('./auth');
const { forbidden } = require('./errors');

class Router {
  constructor() {
    // { 'GET /health': [middlewareOrHandler, ...] }
    this.routes = new Map();
  }

  _add(method, pattern, handlers) {
    if (!handlers.length) throw new Error(`Route ${method} ${pattern} needs a handler`);
    this.routes.set(`${method} ${pattern}`, handlers);
  }

  get(pattern, ...handlers) { this._add('GET', pattern, handlers); }
  post(pattern, ...handlers) { this._add('POST', pattern, handlers); }
  patch(pattern, ...handlers) { this._add('PATCH', pattern, handlers); }
  delete(pattern, ...handlers) { this._add('DELETE', pattern, handlers); }

  /**
   * Find handlers for method+path. Returns { handlers, params } or null.
   * Supports ':param' segments.
   */
  match(method, path) {
    const pathSegments = path.split('/').filter(Boolean);

    for (const [routeKey, handlers] of this.routes.entries()) {
      const [routeMethod, routePattern] = routeKey.split(' ');
      if (routeMethod !== method) continue;

      const routeSegments = routePattern.split('/').filter(Boolean);
      if (routeSegments.length !== pathSegments.length) continue;

      const params = {};
      let matched = true;

      for (let i = 0; i < routeSegments.length; i++) {
        const rs = routeSegments[i];
        const ps = pathSegments[i];

        if (rs.startsWith(':')) {
          params[rs.slice(1)] = safeDecode(ps);
        } else if (rs !== ps) {
          matched = false;
          break;
        }
      }

      if (matched) return { handlers, params };
    }

    return null;
  }

  /** Does ANY route exist for this path (distinguishes 404 from 405)? */
  hasPath(path) {
    const pathSegments = path.split('/').filter(Boolean);
    for (const routeKey of this.routes.keys()) {
      const routeSegments = routeKey.split(' ')[1].split('/').filter(Boolean);
      if (routeSegments.length !== pathSegments.length) continue;

      let matched = true;
      for (let i = 0; i < routeSegments.length; i++) {
        const rs = routeSegments[i];
        const ps = pathSegments[i];
        if (rs.startsWith(':')) continue;
        if (rs !== ps) { matched = false; break; }
      }
      if (matched) return true;
    }
    return false;
  }

  /**
   * Execute the middleware chain for a matched route.
   */
  async dispatch(handlers, req, res, params) {
    req.params = params || {}; // Express-style access for handlers
    for (const handler of handlers) {
      if (res.writableEnded) return; // a middleware already responded
      await handler(req, res, params);
    }
  }
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Middleware factory: authenticate via API key and require a scope.
 * Throws 401/403 ApiErrors that the server converts to JSON responses.
 */
function requireScope(requiredScope) {
  return (req) => {
    const auth = authenticate(req); // throws 401 on bad/missing key
    if (!auth.scopes.includes(requiredScope) && !auth.scopes.includes('admin')) {
      throw forbidden(`Your API key lacks the '${requiredScope}' scope.`);
    }
    req.auth = auth;
  };
}

module.exports = { Router, requireScope };
