# EduKids

Production split for independent deployment:

- `frontend/` - Vite client for Firebase Hosting
- `backend/` - Node.js/Express API for Render

## Structure

```text
EduKids/
  frontend/
    index.html
    public/
    src/
    package.json
  backend/
    server.js
    routes/
    controllers/
    services/
    package.json
  README.md
  .gitignore
```

## Run Locally

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Backend:

```bash
cd backend
npm install
node server.js
```

## Environment

Frontend API URL:

```bash
frontend/.env
VITE_API_URL=http://localhost:5000
```

Backend Firebase credentials stay in `backend/.env` or `backend/serviceAccountKey.json` for local development.

## Notes

- Frontend API calls read `import.meta.env.VITE_API_URL`.
- Backend CORS is open for all origins for now.
- Firebase integration is preserved in both client and server code.
