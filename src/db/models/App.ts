import { Model, DataTypes, Sequelize } from 'sequelize';
import { randomBytes } from 'crypto';

interface AppAttributes {
  id: number;
  name: string;
  slug: string;
  description: string;
  ownerId: number;
  githubRepoUrl?: string;
  appKey: string;
  createdAt: Date;
  updatedAt: Date;
}

interface AppCreationAttributes {
  name: string;
  slug: string;
  description: string;
  ownerId: number;
  githubRepoUrl?: string;
  appKey?: string;
}

class App extends Model<AppAttributes, AppCreationAttributes> implements AppAttributes {
  public id!: number;
  public name!: string;
  public slug!: string;
  public description!: string;
  public ownerId!: number;
  public githubRepoUrl?: string;
  public appKey!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Instance methods
  public async regenerateAppKey(): Promise<string> {
    const newKey = App.generateAppKey();
    await this.update({ appKey: newKey });
    return newKey;
  }

  // Static methods
  public static generateAppKey(): string {
    return randomBytes(16).toString('hex');
  }

  // Associations
  public static associate(models: any): void {
    App.belongsTo(models.User, {
      foreignKey: 'ownerId',
      as: 'owner'
    });

    App.hasMany(models.AppUser, {
      foreignKey: 'appId',
      as: 'userAccess'
    });

    App.hasMany(models.Update, {
      foreignKey: 'appId',
      as: 'updates'
    });

    App.hasMany(models.Bundle, {
      foreignKey: 'appId',
      as: 'bundles'
    });

    App.hasMany(models.Manifest, {
      foreignKey: 'appId',
      as: 'manifests'
    });
  }

  // Static initialization method
  public static initialize(sequelize: Sequelize): void {
    App.init({
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      slug: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          is: /^[a-z0-9-]+$/i,
        },
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      ownerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'owner_id',
      },
      githubRepoUrl: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'github_repo_url',
      },
      appKey: {
        type: DataTypes.STRING(32),
        allowNull: false,
        unique: true,
        field: 'app_key',
        defaultValue: () => App.generateAppKey(),
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
      tableName: 'apps',
      timestamps: true,
      underscored: true
    });
  }
}

export default App;