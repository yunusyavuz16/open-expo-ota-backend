declare module '../config/sequelize-cli-config' {
  interface SequelizeConfig {
    username: string;
    password: string;
    database: string;
    host: string;
    port: number;
    dialect: string;
    dialectOptions: {
      ssl: {
        require: boolean;
        rejectUnauthorized: boolean;
      };
    };
    logging: boolean | ((msg: string) => void);
  }

  interface SequelizeConfigs {
    development: SequelizeConfig;
    test: SequelizeConfig;
    production: SequelizeConfig;
  }

  const config: SequelizeConfigs;
  export default config;
}

declare module '../config/sequelize-cli-config.js' {
  import config from '../config/sequelize-cli-config';
  export default config;
}