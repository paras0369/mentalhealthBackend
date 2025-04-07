# Mental Health API

This is a simple Node API to create and sign in users with [Stream](https://dub.sh/getstream) and JWT authentication using in-memory data.

## Features

- User authentication and authorization
- Schedule consultations with therapists

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- MongoDB
- Stream account and credentials

## Environment Setup

Clone the repository:

```bash
git clone https://github.com/Galaxies-dev/mental-health-api
cd mental-health-api
```

Copy the `DUMMY.env` file to `.env` and fill in the following variables:

```env
PORT=3000
STREAM_API_KEY=your_stream_api_key
STREAM_API_SECRET=your_stream_api_secret
JWT_SECRET=your_jwt_secret
```

Install dependencies:

```bash
npm install
```

## Running the API

Development mode:

```bash
npm run start:dev
```

Production mode:

```bash
npm run build
npm start
```

The API will be available at `http://localhost:3000`

## API Documentation

### Authentication Endpoints

- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login existing user

### Consultation Endpoints

- `POST /consultations` - Schedule a new consultation
- `GET /consultations` - Get all consultations
- `PATCH /consultations/:id` - Update consultation status

## 🚀 More

**Take a shortcut from web developer to mobile development fluency with guided learning**

Enjoyed this project? Learn to use React Native to build production-ready, native mobile apps for both iOS and Android based on your existing web development skills.

<a href="https://galaxies.dev"><img src="banner.png" height="auto" width="100%"></a>
