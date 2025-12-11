import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';
import { seedDatabase } from './seed';

// Load environment variables
config({ path: join(__dirname, '../../../.env') });

async function runSeed() {
  const dataSource = new DataSource({
    type: 'better-sqlite3',
    database: process.env.DATABASE_PATH || './data/kiosk.db',
    entities: [join(__dirname, '../../**/*.entity{.ts,.js}')],
    synchronize: true,
    logging: false,
    enableWAL: true,
  });

  try {
    await dataSource.initialize();
    console.log('✅ Database connection established');

    await seedDatabase(dataSource);

    console.log('✅ Seeding completed successfully\n');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

runSeed();
