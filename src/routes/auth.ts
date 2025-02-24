import { Request, Response, Router } from 'express';
import { StreamChat } from 'stream-chat';
import { hashSync } from 'bcrypt';
import { SALT, USERS, UserRole } from '../models/user';

const router = Router();

const { STREAM_API_KEY, STREAM_API_SECRET } = process.env;
const client = StreamChat.getInstance(STREAM_API_KEY!, STREAM_API_SECRET);

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
    const id = Math.random().toString(36).substr(2, 9);
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

  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
    },
  });
});

export default router;
