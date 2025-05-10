import passport from 'passport';
import { Strategy as GitHubStrategy, Profile } from 'passport-github2';
import { Strategy as JwtStrategy, ExtractJwt, VerifiedCallback } from 'passport-jwt';
import dotenv from 'dotenv';
import UserRepository from '../repositories/UserRepository';
import { UserRole, User } from '../types';

dotenv.config();

// Initialize GitHub strategy
passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID || '',
  clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
  callbackURL: process.env.GITHUB_CALLBACK_URL || 'http://localhost:3000/api/auth/github/callback',
  scope: ['user:email', 'read:org'],
}, async (accessToken: string, refreshToken: string, profile: Profile, done: (error: Error | null, user?: any) => void) => {
  try {
    // Find or create user
    let user = await UserRepository.findByGithubId(parseInt(profile.id, 10));

    if (!user) {
      // Get primary email
      const emails = profile.emails || [];
      const primaryEmail = emails.length > 0 ? emails[0].value : '';

      user = await UserRepository.create({
        githubId: parseInt(profile.id, 10),
        username: profile.username || '',
        email: primaryEmail,
        role: UserRole.DEVELOPER, // Default role
        accessToken,
      });
    } else {
      // Update access token
      await UserRepository.update(user.id, { accessToken });
    }

    return done(null, user);
  } catch (error) {
    return done(error instanceof Error ? error : new Error(String(error)));
  }
}));

// Initialize JWT strategy
passport.use(new JwtStrategy({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET || 'default_jwt_secret',
}, async (jwtPayload: { id: number }, done: VerifiedCallback) => {
  try {
    const user = await UserRepository.findById(jwtPayload.id);

    if (!user) {
      return done(null, false);
    }

    return done(null, user);
  } catch (error) {
    return done(error instanceof Error ? error : new Error(String(error)));
  }
}));

// Serialization and deserialization
passport.serializeUser((user: Express.User, done) => {
  // Safely access the id property, assuming it exists on our User objects
  const userId = (user as unknown as User).id;
  done(null, userId);
});

passport.deserializeUser(async (id: number, done) => {
  try {
    const user = await UserRepository.findById(id);
    done(null, user);
  } catch (error) {
    done(error instanceof Error ? error : new Error(String(error)));
  }
});

export default passport;