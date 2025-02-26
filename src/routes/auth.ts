import { Request, Response, Router } from 'express';
import { StreamChat } from 'stream-chat';
import { hashSync } from 'bcrypt';
import { USERS, UserRole } from '../models/user';
import dotenv from 'dotenv';
import { sign } from 'jsonwebtoken';
// Load environment variables
dotenv.config();

const router = Router();

const SALT = process.env.SALT as string;
const streamApiKey = process.env.STREAM_API_KEY;
const streamApiSecret = process.env.STREAM_API_SECRET;

if (!streamApiKey || !streamApiSecret) {
  throw new Error('STREAM_API_KEY and STREAM_API_SECRET must be defined in environment variables');
}

const client = StreamChat.getInstance(streamApiKey, streamApiSecret);

// Register endpoint
router.post('/register', async (req: Request, res: Response): Promise<any> => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: 'Email and password are required.',
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      message: 'Password must be at least 6 characters.',
    });
  }

  const existingUser = USERS.find((user) => user.email === email);

  if (existingUser) {
    return res.status(400).json({
      message: 'User already exists.',
    });
  }

  try {
    const hashed_password = hashSync(password, SALT);
    const id = Math.random().toString(36).substring(2, 9);
    const user = {
      id,
      email,
      hashed_password,
      role: UserRole.Client,
    };
    USERS.push(user);

    await client.upsertUser({
      id,
      email,
      name: email,
    });

    const token = client.createToken(id);

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (e) {
    return res.json({
      message: 'User already exists.',
    });
  }
});

// Login endpoint
router.post('/login', async (req: Request, res: Response): Promise<any> => {
  const { email, password } = req.body;
  const user = USERS.find((user) => user.email === email);
  const hashed_password = hashSync(password, SALT);

  if (!user || user.hashed_password !== hashed_password) {
    return res.status(400).json({
      message: 'Invalid credentials.',
    });
  }

  const token = client.createToken(user.id);

  const jwt = sign({ userId: user.id }, process.env.JWT_SECRET!);

  return res.json({
    token,
    jwt,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  });
});

// Endpoint to create a therapist user
router.post('/create-therapist', async (req: Request, res: Response): Promise<any> => {
  const { email, password } = req.body;

  const hashed_password = hashSync(password, SALT);
  const id = Math.random().toString(36).substring(2, 9);
  const user = {
    id,
    email,
    hashed_password,
    role: UserRole.Therapist,
  };

  USERS.push(user);

  await client.upsertUser({
    id,
    email,
    name: email,
    role: UserRole.Therapist,
  });

  return res.json({
    message: 'Therapist user created successfully.',
    user,
  });
});

export default router;
