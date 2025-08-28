import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { sql } from './db';
import { secureLog } from './secure-logger';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

export interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'client' | 'demo';
}

// Hash password
export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 10);
};

// Verify password
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

// Generate JWT token
export const generateToken = (user: User): string => {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Verify JWT token
export const verifyToken = (token: string): any => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
};

// Create user
export const createUser = async (
  email: string, 
  password: string, 
  name: string, 
  role: 'admin' | 'client' | 'demo' = 'client'
): Promise<User | null> => {
  try {
    secureLog.info('Creating user:', { email, name, role });
    const hashedPassword = await hashPassword(password);
    secureLog.debug('Password hashed successfully');
    
    const result = await sql`
      INSERT INTO users (email, password_hash, name, role)
      VALUES (${email}, ${hashedPassword}, ${name}, ${role})
      RETURNING id, email, name, role, created_at
    `;
    
    secureLog.info('User insert successful:', result[0]);
    return result[0] as User;
  } catch (error) {
    secureLog.error('Create user error:', error);
    secureLog.error('Error details:', {
      message: error?.message || 'No error message',
      code: error?.code || 'No error code',
      constraint: error?.constraint || 'No constraint',
      detail: error?.detail || 'No detail'
    });
    return null;
  }
};

// Login user
export const loginUser = async (email: string, password: string): Promise<User | null> => {
  try {
    const result = await sql`
      SELECT id, email, password_hash, name, role
      FROM users 
      WHERE email = ${email}
    `;
    
    if (!result[0]) return null;
    
    const user = result[0] as User & { password_hash: string };
    const isValid = await verifyPassword(password, user.password_hash);
    
    if (!isValid) return null;
    
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    };
  } catch (error) {
    console.error('Login error:', error);
    return null;
  }
};