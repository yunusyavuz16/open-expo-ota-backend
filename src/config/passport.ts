import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { db } from '../db/context';
import { UserRole } from '../types';
import { User } from '../models';

// GitHub OAuth Strategy
passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID || '',
  clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
  callbackURL: process.env.GITHUB_CALLBACK_URL || 'http://localhost:3000/api/auth/github/callback'
}, async (accessToken: string, refreshToken: string, profile: any, done: any) => {
  try {
    // Check if user exists
    let user = await db.models.User.findOne({
      where: { githubId: profile.id }
    });

    if (user) {
      // Update access token
      await user.update({ accessToken });
      return done(null, user);
    }

    // Create new user
    const email = profile.emails && profile.emails.length > 0
      ? profile.emails[0].value
      : `${profile.username}@github.com`;

    // Check if this is the first user (make them admin)
    const userCount = await db.models.User.count();
    const isFirstUser = userCount === 0;

    user = await db.models.User.create({
      githubId: profile.id,
      username: profile.username,
      email,
      role: isFirstUser ? UserRole.ADMIN : UserRole.DEVELOPER,
      accessToken
    });

    return done(null, user);
  } catch (error) {
    console.error('Error in GitHub authentication:', error);
    return done(error);
  }
}));

// JWT Strategy for API authentication
passport.use(new JwtStrategy({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET || 'default_jwt_secret'
}, async (payload: any, done: any) => {
  try {
    // Find user by ID from JWT payload
    const user = await db.models.User.findByPk(payload.id);

    if (!user) {
      return done(null, false);
    }

    return done(null, user);
  } catch (error) {
    console.error('Error in JWT authentication:', error);
    return done(error, false);
  }
}));

// Serialization and deserialization
passport.serializeUser((user: Express.User, done) => {
  // Safely access the id property
  const userId = (user as any).id;
  done(null, userId);
});

passport.deserializeUser(async (id: number, done) => {
  try {
    const user = await db.models.User.findByPk(id);
    done(null, user);
  } catch (error) {
    done(error instanceof Error ? error : new Error(String(error)));
  }
});

export default passport;