import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import { UserRole } from '../types';

interface AppUserAttributes {
  id: number;
  appId: number;
  userId: number;
  role: UserRole;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AppUserInput extends Optional<AppUserAttributes, 'id' | 'createdAt' | 'updatedAt'> {}
export interface AppUserOutput extends Required<AppUserAttributes> {}

class AppUser extends Model<AppUserAttributes, AppUserInput> implements AppUserAttributes {
  public id!: number;
  public appId!: number;
  public userId!: number;
  public role!: UserRole;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Define associations
  static associate(models: any) {
    // AppUser has no direct associations to define
    // The associations are handled in the User and App models
  }
}

AppUser.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  appId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'app_id',
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'user_id',
  },
  role: {
    type: DataTypes.ENUM(...Object.values(UserRole)),
    allowNull: false,
    defaultValue: UserRole.DEVELOPER,
  },
}, {
  sequelize,
  tableName: 'app_users',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['app_id', 'user_id'],
    },
  ],
});

export default AppUser;