# Agahee — Backend

Backend API + Socket.io server for Agahee, a real-time business chat application.
Node.js, Express, TypeScript, MongoDB (Mongoose), Socket.io, JWT authentication.

Deadline: **August 20, 2026**

## Getting Started

```bash
git clone https://github.com/sjk-txend/agahee-backend.git
cd agahee-backend
npm install
```

Create a `.env` file in the root (never commit this — it's gitignored):

```
PORT=5000
MONGO_URI=<ask a teammate for the shared Atlas connection string>
JWT_SECRET=<any long random string for local dev>
CLIENT_URL=http://localhost:5173
```

Then:

```bash
npm run typecheck   # should produce no output at all if everything's correct
npm run dev          # starts the server on http://localhost:5000
```

You should see:
```
MongoDB connected
Server running on http://localhost:5000
```

## Project Structure

```
src/
├── config/        MongoDB connection setup
├── middleware/     auth (JWT verification), centralized error handling
├── models/         Mongoose schemas + TypeScript interfaces
├── services/       business logic — the layer that actually does the work
├── controllers/    thin HTTP layer — pulls request data, calls a Service, shapes the response
├── routes/         maps URLs + HTTP methods to Controller functions
├── sockets/        Socket.io real-time event handlers
├── types/          shared TypeScript types + Express type augmentation
├── utils/          small shared helpers (e.g. AppError)
└── index.ts         entry point — wires everything together and starts the server
```

Every feature follows the same flow: **Route → Controller → Service → Model → Database**, with
Middleware (like auth) running before the Route. Socket.io events skip the Controller layer
entirely and call Services directly, since they aren't HTTP requests.

## What's Already Built

| Feature | Status | Files |
|---|---|---|
| User registration & login (JWT + bcrypt) | ✅ Done | `authController.ts`, `authService.ts`, `authRoutes.ts` |
| Message send/receive (REST + Socket.io) | ✅ Done | `messageController.ts`, `messageService.ts`, `messageRoutes.ts`, `sockets/` |
| Message history (paginated) | ✅ Done | part of `messageService.ts` |
| Delete message (universal soft delete) | ✅ Done | part of `messageService.ts` |
| Pin message (capped at 5 per conversation) | ✅ Done | part of `messageService.ts` |
| Message reactions | ✅ Done | part of `messageService.ts` |
| Typing indicator, online/offline status | ✅ Done | `sockets/index.ts` |
| **Document sharing (Multer)** | 🚧 In progress | see below |
| User search / block-unblock | ⬜ Not started | |
| Forgot/reset password | ⬜ Not started | |
| AI chatbot (summarize/suggest-reply) | ⬜ Not started | |

## Data Model — Important Context

There is **no `Conversation` collection**. This was a deliberate simplification once group
chat was cut from scope — a `Message` stores `senderId` and `recipientId` directly, and "a
conversation" is just the set of messages between two specific users. See `docs/ERD.png` for
the full diagram.

Only two collections exist right now: `User` and `Message`. Document sharing will add a third:
`Document`, linked to a `Message` via `messageId`.

## Document Sharing — What You're Building

**Goal:** let a user attach a file to a message within a conversation.

**Data model** (matches the ERD — one new collection):
```
Document {
  id: ObjectId (pk)
  messageId: ObjectId (ref Message, required)
  fileName: string
  filePath: string
  fileSize: number
  mimeType: string
  uploadedAt: Date
}
```

**Endpoints to build** (matches the project's API contract convention):

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/api/documents/upload` | 🔒 required | Upload a document, linked to a message |
| GET | `/api/documents/:id/download` | 🔒 required | Download a document |

**Upload request shape** (`multipart/form-data`, not JSON):
```
document       — the file itself (PDF, DOC, DOCX, TXT — 10MB max recommended)
messageId      — string, the message this document is attached to
```

**Files to create**, following the same pattern as everything else in this repo:
```
src/middleware/upload.ts        — Multer config: storage engine, file type filter, size limit
src/models/Document.ts          — Mongoose schema + TS interface, per the shape above
src/services/documentService.ts — save the document record, fetch for download
src/controllers/documentController.ts — thin HTTP layer, same shape as messageController.ts
src/routes/documentRoutes.ts    — wires the two endpoints above
```

Then in `src/index.ts`, add:
```ts
import documentRoutes from './routes/documentRoutes.js';
app.use('/api/documents', documentRoutes);
```

**Read `messageController.ts` and `messageService.ts` first** — your files should follow the
exact same structure (thin controller, real logic in the Service, `AppError` for failures,
`req.user!.id` for the authenticated user, never trust the client for identity).

**Multer specifics to get right:**
- Reject anything that isn't PDF/DOC/DOCX/TXT via a `fileFilter`
- Cap file size (10MB is a reasonable default)
- Store uploaded files in an `uploads/` folder — **make sure this is in `.gitignore`**, uploaded files should never be committed to the repo
- Test both the success case AND the rejection cases (wrong file type, oversized file) — don't just test the happy path

## Testing Your Work

**Use Postman, not curl** — Windows PowerShell mangles JSON quoting in curl commands
constantly; Postman avoids this entirely and is what the rest of the team is using.

1. Register/login first to get a JWT (`POST /api/auth/login`)
2. For the upload endpoint specifically: Postman → Body tab → **form-data** (not raw JSON) →
   add a `document` key, change its type from Text to **File**, pick a file → add a
   `messageId` key (Text) with a real message ID from your database
3. Confirm the upload in MongoDB Atlas directly — check the `documents` collection, and check
   the file actually exists on disk in your `uploads/` folder

## Branching

```bash
git checkout dev
git pull
git checkout -b feature/document-sharing
```

Work here, commit as you go, push, then open a Pull Request into `dev` (never `main` directly).
Small, frequent commits are easier to review than one giant one at the end.

## Questions / Blocked?

Message Saad directly rather than guessing — especially anything touching how `Message`
already works, since that model's shape is load-bearing for this feature.