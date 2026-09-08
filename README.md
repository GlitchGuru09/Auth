# Authentication API

An Express and MongoDB authentication API with email verification, JWT access tokens, and cookie-based refresh-token sessions.

## Features

- User registration with username, email, and password
- OTP email verification
- Login with a 15-minute access token
- Seven-day refresh-token sessions stored in MongoDB
- Get the currently authenticated user
- Logout from the current session or all sessions

## Requirements

- Node.js 18 or later
- MongoDB database
- Gmail OAuth2 credentials for sending verification emails

## Installation

```bash
npm install
```

Create a `.env` file in the project root. Never commit this file or share its values.

```env
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>/<database>
JWT_SECRET=<long-random-secret>

GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>
GOOGLE_REFRESH_TOKEN=<google-oauth-refresh-token>
GOOGLE_USER=<gmail-address>
```

The Gmail OAuth client, client secret, and refresh token must belong to the same OAuth client. The refresh token must include the `https://mail.google.com/` scope. See [Nodemailer's Gmail OAuth2 documentation](https://nodemailer.com/usage/using-gmail/) when configuring email delivery.

## Running the server

```bash
node server.js
```

The server listens on `http://localhost:3000`.

The development script is intended to run Nodemon, but currently contains an extra `npm` argument. Run `npx nodemon server.js` directly, or update the script to:

```json
"dev": "nodemon server.js"
```

## Authentication flow

1. Call `POST /api/auth/register`.
2. Read the OTP from the verification email.
3. Call `GET /api/auth/verify-email?email=...&otp=...`.
4. Call `POST /api/auth/login`.
5. Store the returned access token and send it as a Bearer token.
6. Preserve the `refreshToken` cookie for access-token rotation and logout.

The access token expires after 15 minutes. The refresh-token session expires after seven days.

## API reference

All endpoints are prefixed with `http://localhost:3000/api/auth`.

### Register

```http
POST /register
Content-Type: application/json

{
	"username": "Karen Lobo",
	"email": "karen@example.com",
	"password": "a-strong-password"
}
```

Returns `201 Created` and sends an OTP email.

### Verify email

```http
GET /verify-email?email=karen%40example.com&otp=123456
```

Returns `200 OK` when the OTP is valid. The OTP is single-use.

### Login

```http
POST /login
Content-Type: application/json

{
	"email": "karen@example.com",
	"password": "a-strong-password"
}
```

Returns an `accessToken` and sets an HTTP-only `refreshToken` cookie. The email must be verified before login.

### Get current user

```http
GET /get-me
Authorization: Bearer <access-token>
```

Returns the authenticated user's username and email.

### Refresh access token

```http
GET /refresh-token
```

Requires the `refreshToken` cookie and returns a new access token. Clients must send and accept cookies for this request.

### Logout

```http
GET /logout
```

Revokes the current refresh-token session and clears the cookie.

### Logout all sessions

```http
GET /logout-all
```

Revokes all refresh-token sessions belonging to the current user and clears the cookie.

## Postman

Import [`src/postman_collection/AUTHENTICATION.postman_collection.json`](src/postman_collection/AUTHENTICATION.postman_collection.json) into Postman. The collection contains requests for registration, login, email verification, getting the current user, token rotation, logout, and logout from all devices.

For login, enable Postman's cookie jar so the `refreshToken` cookie is retained for refresh and logout requests. Replace the example credentials and set the bearer-token variable after login.

## Project structure

```text
server.js                          Application entry point
src/app.js                         Express and middleware setup
src/config/config.js               Environment variable loading
src/config/database.js             MongoDB connection
src/routes/auth.routes.js          Authentication routes
src/controllers/auth.controller.js Authentication logic
src/models/user.model.js           User schema
src/models/session.model.js        Refresh-token session schema
src/models/otp.modal.js            Email OTP schema
src/services/email.service.js      Gmail email transport
src/utils/utils.js                 OTP and email helpers
```

## Known local-development notes

- The refresh-token cookie is configured with `secure: true`. Browsers normally do not store secure cookies over plain HTTP, so use HTTPS locally or adjust this setting for local development.
- The refresh-token lookup in `refreshToken` currently uses `refreshTokenhash`, while the schema field is `refreshTokenHash`. Correct the casing before relying on token rotation.
- Keep OAuth credentials, the MongoDB connection string, and `JWT_SECRET` private. Rotate any credential that has been exposed.