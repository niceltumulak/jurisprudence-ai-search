# Jurisprudence AI Search

A production-ready, AI-powered RAG (Retrieval-Augmented Generation) search engine for Philippine law, jurisprudence, and Supreme Court rulings.

## 🎯 Features

- **Deep Legal Search**: Semantic + keyword hybrid search across Philippine Supreme Court decisions
- **Anti-Hallucination Verification**: Multi-pass verification loops ensure no fictitious citations
- **Strict 5-Result Standard**: Always returns at least 5 highly relevant cases with:
  - Accurate case titles & G.R. numbers
  - Exact codal provisions cited
  - Verbatim quoted portions
  - AI-generated legal analysis tied to your facts
- **Dark & Light Themes**: Optimized for long research sessions (pale navy/gray dark mode)
- **User Authentication**: Sign-in/sign-up with free 15-day trial
- **Monetization Ready**:
  - Pro Monthly: ₱199/month
  - Pro Annual: ₱1,910.40/year (20% discount)
  - 3-Day Flash Pass: ₱799
  - Philippine payment integrations (GCash, Maya, InstaPay)
- **Admin Dashboard**: Full platform management, API key rotation, user metrics

## 🏗️ Architecture

- **Frontend**: HTML5 + Vanilla JavaScript SPA (Cloudflare Pages)
- **Backend**: Cloudflare Workers (serverless)
- **Database**: Cloudflare D1 (SQL) + Cloudflare Vectorize (vector embeddings)
- **Integrations**:
  - Claude API (legal analysis & NLP)
  - Lawphil.net + SC E-Library (case scraping)
  - Payment gateways (PayMongo, Xendit)

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- Wrangler CLI (`npm install -g wrangler`)
- Cloudflare account with Pages & Workers enabled

### Setup

```bash
# Clone repository
git clone https://github.com/niceltumulak/jurisprudence-ai-search.git
cd jurisprudence-ai-search

# Install dependencies
npm install

# Create wrangler.toml (see template)
cp wrangler.example.toml wrangler.toml

# Initialize D1 database
wrangler d1 create jurisprudence_db
wrangler d1 execute jurisprudence_db --file database.sql

# Deploy to Cloudflare
wrangler deploy
```

### Environment Variables

```bash
# .env.production
JWT_SECRET=your-very-secure-secret-key-here
CLAUDE_API_KEY=sk-... # From Anthropic
VECTORIZE_API_TOKEN=...
LAWPHIL_SCRAPER_API_KEY=...
PAYMONGO_SECRET_KEY=... # For payments
```

## 📖 API Endpoints

### Authentication
- `POST /api/auth/signup` — Register new user
- `POST /api/auth/signin` — Sign in with email/password
- `GET /api/auth/me` — Get current user profile (requires auth)

### Search & RAG
- `POST /api/search` — Execute RAG search (requires auth)
  ```json
  {
    "query": "What are grounds for annulment of marriage?"
  }
  ```

### Subscriptions
- `GET /api/subscription/status` — Check subscription (requires auth)
- `POST /api/subscription/upgrade` — Upgrade plan (requires auth)

### Admin (requires admin role)
- `GET /api/admin/metrics` — Platform metrics
- `GET /api/admin/users` — List all users
- `GET /api/admin/api-keys` — List API keys
- `POST /api/admin/api-keys/rotate` — Rotate service API key

## 🔐 Security

- **JWT-based authentication** with 7-day token expiry
- **Password hashing** via SHA-256 (upgrade to bcrypt for production)
- **CORS protection** on all endpoints
- **Rate limiting** via Cloudflare Workers
- **No hallucination**: Every citation verified against database

## 📊 Data Model

### Users Table
```sql
id, email, password_hash, name, role, created_at, updated_at
```

### Subscriptions Table
```sql
id, user_id, plan, status, started_at, expires_at
```

### Verified Cases Table
```sql
id, gr_number, case_title, date_of_decision, court, codal_provisions, 
quoted_portion, source_url, embedding_vector, verified_at
```

## 🛠️ Development

```bash
# Local development
npm run dev

# Build CSS
npm run build:css

# Seed database with sample cases
npm run db:seed
```

## 📄 License

MIT License - See LICENSE file

## 👨‍💼 Author

**Nicél Tumulak**  
Principal Full-Stack Engineer | Philippine Legal Informatics Specialist

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

For issues, questions, or feature requests, please open a GitHub issue or contact the development team.

---

**Deploy Status**: ✅ Production Ready