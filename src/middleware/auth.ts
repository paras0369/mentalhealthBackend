import { Request, Response, NextFunction } from 'express';
import { USERS } from '../models/user';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const { JWT_SECRET } = process.env;

declare global {
  namespace Express {
    interface Request {
      user?: (typeof USERS)[0];
    }
  }
}

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: 'Authorization required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const { userId } = jwt.verify(token, JWT_SECRET!) as { userId: string };

    const user = USERS.find((u) => u.id === userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};
