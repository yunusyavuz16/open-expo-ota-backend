import User from './User';
import App from './App';
import AppUser from './AppUser';
import Bundle from './Bundle';
import Manifest from './Manifest';
import Update from './Update';
import Asset from './Asset';
import sequelize from '../config/database';

// Set up associations
const setupAssociations = () => {
  // Type assertions to tell TypeScript that these methods exist
  (User as any).associate?.({ App, AppUser, Update });
  (App as any).associate?.({ User, AppUser, Update, Bundle, Manifest });
  (AppUser as any).associate?.({ User, App });
  (Bundle as any).associate?.({ App, Update });
  (Manifest as any).associate?.({ App, Update });
  (Update as any).associate?.({ App, User, Bundle, Manifest, Asset });
  (Asset as any).associate?.({ Update });
};

export {
  sequelize,
  User,
  App,
  AppUser,
  Bundle,
  Manifest,
  Update,
  Asset,
  setupAssociations
};

export default {
  sequelize,
  User,
  App,
  AppUser,
  Bundle,
  Manifest,
  Update,
  Asset,
  setupAssociations
};