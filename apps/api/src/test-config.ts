import { Options } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';
import { User } from './entities/user.entity';

export const testConfig: Options = {
  driver: PostgreSqlDriver,
  host: process.env.TEST_DB_HOST || 'localhost',
  port: parseInt(process.env.TEST_DB_PORT || '5433'),
  user: process.env.TEST_DB_USER || 'maps_test_user',
  password: process.env.TEST_DB_PASSWORD || 'maps_test_password',
  dbName: process.env.TEST_DB_NAME || 'maps_test_db',
  entities: [User],
  debug: false,
  metadataProvider: TsMorphMetadataProvider,
  allowGlobalContext: true, // Required for testing
  ensureDatabase: true, // Auto-create database if it doesn't exist
}; 