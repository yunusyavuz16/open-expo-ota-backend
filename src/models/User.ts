import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import { UserRole } from '../types';

interface UserAttributes {
  id: number;
  githubId: number;
  username: string;
  email: string;
  role: UserRole;
  accessToken: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserInput extends Optional<UserAttributes, 'id' | 'createdAt' | 'updatedAt'> {}
export interface UserOutput extends Required<UserAttributes> {}

class User extends Model<UserAttributes, UserInput> implements UserAttributes {
  public id!: number;
  public githubId!: number;
  public username!: string;
  public email!: string;
  public role!: UserRole;
  public accessToken!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Define associations
  static associate(models: any) {
    User.hasMany(models.Update, { foreignKey: 'publishedBy', as: 'publishedUpdates' });
    User.belongsToMany(models.App, {
      through: models.AppUser,
      foreignKey: 'userId',
      otherKey: 'appId',
      as: 'apps'
    });
  }
}

User.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  githubId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    field: 'github_id',
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isEmail: true,
    },
  },
  role: {
    type: DataTypes.ENUM(...Object.values(UserRole)),
    allowNull: false,
    defaultValue: UserRole.DEVELOPER,
  },
  accessToken: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'access_token',
  },
}, {
  sequelize,
  tableName: 'users',
  timestamps: true,
  underscored: true,
});

export default User;