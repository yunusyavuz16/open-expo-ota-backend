import { Model, DataTypes, Sequelize } from 'sequelize';
import { UserRole } from '../../types';

interface AppUserAttributes {
  id: number;
  appId: number;
  userId: number;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

interface AppUserCreationAttributes {
  appId: number;
  userId: number;
  role?: UserRole;
}

class AppUser extends Model<AppUserAttributes, AppUserCreationAttributes> implements AppUserAttributes {
  public id!: number;
  public appId!: number;
  public userId!: number;
  public role!: UserRole;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public static associate(models: any): void {
    AppUser.belongsTo(models.App, {
      foreignKey: 'appId',
      as: 'app'
    });

    AppUser.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });
  }

  // Static initialization method
  public static initialize(sequelize: Sequelize): void {
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
        references: {
          model: 'apps',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'user_id',
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      role: {
        type: DataTypes.ENUM(...Object.values(UserRole)),
        allowNull: false,
        defaultValue: UserRole.DEVELOPER,
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
      tableName: 'app_users',
      timestamps: true,
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ['app_id', 'user_id']
        }
      ]
    });
  }
}

export default AppUser;