import { Model, DataTypes, Association, Sequelize } from 'sequelize';
import { UserRole } from '../../types';

interface UserAttributes {
  id: number;
  githubId: number;
  username: string;
  email: string;
  role: UserRole;
  accessToken: string;
  createdAt: Date;
  updatedAt: Date;
}

interface UserCreationAttributes {
  githubId: number;
  username: string;
  email: string;
  role?: UserRole;
  accessToken: string;
}

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: number;
  public githubId!: number;
  public username!: string;
  public email!: string;
  public role!: UserRole;
  public accessToken!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public static associate(models: any): void {
    User.hasMany(models.App, {
      foreignKey: 'ownerId',
      as: 'ownedApps'
    });

    User.hasMany(models.AppUser, {
      foreignKey: 'userId',
      as: 'appAccess'
    });

    User.hasMany(models.Update, {
      foreignKey: 'publishedBy',
      as: 'publishedUpdates'
    });
  }

  // Static initialization method
  public static initialize(sequelize: Sequelize): void {
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
        field: 'github_id'
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
        type: DataTypes.TEXT,
        allowNull: false,
        field: 'access_token'
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'created_at'
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'updated_at'
      }
    }, {
      sequelize,
      tableName: 'users',
      timestamps: true,
      underscored: true
    });
  }
}

export default User;