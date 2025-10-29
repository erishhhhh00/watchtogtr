import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { authLimiter } from '../middleware/rateLimiter';
import { AppError } from '../middleware/errorHandler';
import Joi from 'joi';

export const authRouter = Router();

// In-memory user store (replace with database in production)
const users = new Map<string, any>();

const registerSchema = Joi.object({
  username: Joi.string().min(3).max(20).required(),
  email: Joi.string().email().optional(),
  password: Joi.string().min(6).required(),
});

const loginSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required(),
});

authRouter.post('/register', authLimiter, async (req, res, next) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400);
    }

    const { username, email, password } = value;

    // Check if user exists
    const existingUser = Array.from(users.values()).find(u => u.username === username);
    if (existingUser) {
      throw new AppError('Username already exists', 409);
    }

    const userId = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = {
      id: userId,
      username,
      email,
      password: hashedPassword,
      isGuest: false,
      createdAt: new Date(),
    };

    users.set(userId, user);

    const token = jwt.sign(
      { userId, username, isGuest: false },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      user: { id: userId, username, email, isGuest: false },
      token,
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      throw new AppError(error.details[0].message, 400);
    }

    const { username, password } = value;

    const user = Array.from(users.values()).find(u => u.username === username);
    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      throw new AppError('Invalid credentials', 401);
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, isGuest: false },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    res.json({
      user: { id: user.id, username: user.username, email: user.email, isGuest: false },
      token,
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/guest', async (req, res, next) => {
  try {
    const { username } = req.body;
    
    if (!username || username.length < 3) {
      throw new AppError('Username must be at least 3 characters', 400);
    }

    const userId = uuidv4();
    const guestUser = {
      id: userId,
      username: `${username}_${userId.slice(0, 4)}`,
      isGuest: true,
      createdAt: new Date(),
    };

    users.set(userId, guestUser);

    const token = jwt.sign(
      { userId, username: guestUser.username, isGuest: true },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );

    res.json({
      user: { id: userId, username: guestUser.username, isGuest: true },
      token,
    });
  } catch (err) {
    next(err);
  }
});
