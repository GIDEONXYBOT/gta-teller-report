import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import compression from 'compression';

// Production security configuration
const securityMiddleware = (app) => {
  // Enable compression for better performance
  app.use(compression());

  // Enhanced CORS configuration
  const corsOptions = {
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, direct API calls, curl, etc.)
      if (!origin) return callback(null, true);

      // Static allowed origins (can include scheme and host, or host-only patterns)
      const allowedOrigins = [
        'https://www.rmi.gideonbot.xyz',
        'https://rmi.gideonbot.xyz',
        'https://gideon-reports.pages.dev',
        'https://rmi-backend-zhdr.onrender.com', // Backend itself for CORS preflight
        'https://your-domain.pages.dev', // Replace with your Cloudflare domain
        'http://localhost:3000',
        'http://localhost:5173',
        'https://localhost:5173',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173',
        'https://127.0.0.1:5173'
      ];
      
      // Allow any hostname on port 5000 (for network access)
      if (origin && origin.match(/^https?:\/\/[^:]+:5000$/)) {
        console.log('✅ CORS allowed for port 5000 origin:', origin);
        return callback(null, true);
      }
      
      // In production, add your custom domain or comma-separated set of allowed hosts
      // Use FRONTEND_URL for exact host (e.g. https://app.yourdomain.com)
      // Or FRONTEND_ORIGINS for comma-separated patterns (e.g. https://*.yourdomain.com,http://192.168.0.167:5000)
      if (process.env.NODE_ENV === 'production' && process.env.FRONTEND_URL) {
        allowedOrigins.push(process.env.FRONTEND_URL);
      }

      console.log('🔍 FRONTEND_ORIGINS env var:', process.env.FRONTEND_ORIGINS);
      const extra = process.env.FRONTEND_ORIGINS;
      if (extra) {
        const originsFromEnv = extra.split(',').map(s => s.trim()).filter(Boolean);
        console.log('📋 Origins from FRONTEND_ORIGINS:', originsFromEnv);
        originsFromEnv.forEach(s => allowedOrigins.push(s));
      }

      console.log('🔍 CORS check for origin:', origin);
      console.log('📋 allowedOrigins:', allowedOrigins);

      // Match function - supports exact origins, hostname-only and wildcard hostnames like *.yourdomain.com
      const normalizeHost = (urlOrHost) => {
        try {
          return new URL(urlOrHost).hostname;
        } catch (_) {
          return urlOrHost;
        }
      };

      const originHost = normalizeHost(origin);

      for (const allowed of allowedOrigins) {
        if (!allowed) continue;

        // exact origin match (scheme + host + optional port)
        if (allowed === origin) return callback(null, true);

        // hostname-only or wildcard hostname matching
        const allowedHost = normalizeHost(allowed);
        if (!allowedHost) continue;

        if (allowedHost.includes('*')) {
          // convert wildcard host (*.example.com) into a safe regex
          const escaped = allowedHost.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&');
          const pattern = '^' + escaped.replace('\\*', '.*') + '$';
          const re = new RegExp(pattern, 'i');
          if (re.test(originHost)) return callback(null, true);
        } else if (allowedHost === originHost) {
          return callback(null, true);
        }
      }

      console.log('⚠️  CORS blocked request from:', origin);
      callback(new Error('Not allowed by CORS'));
      return;
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with', 'Accept', 'Cache-Control', 'cache-control', 'Pragma']
  };

  app.use(cors(corsOptions));

  // Security headers with Helmet
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", "wss:", "ws:"],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'", "https:", "data:"]
      }
    },
    crossOriginEmbedderPolicy: false // Allow cross-origin requests for API
  }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs (was 100)
    message: {
      error: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for GET requests (read-only operations)
      if (req.method === 'GET') {
        return true;
      }
      return false;
    }
  });

  // Authentication rate limiting (stricter)
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit login attempts (was 5)
    message: {
      error: 'Too many login attempts, please try again later.'
    },
    skipSuccessfulRequests: true
  });

  // Apply general rate limiting
  app.use(limiter);

  // Apply auth rate limiting to auth routes
  app.use('/api/auth', authLimiter);
  app.use('/api/authRoutes', authLimiter);

  console.log('🔒 Security middleware initialized');
};

export default securityMiddleware;